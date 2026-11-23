use std::time::Duration;

use reqwest::{Client, Method, StatusCode, Url, redirect::Policy};
use serde::Deserialize;
use zeroize::Zeroize;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ConnectionInput {
    kind: String,
    url: String,
    username: String,
    password: String,
}

impl Drop for ConnectionInput {
    fn drop(&mut self) {
        self.password.zeroize();
    }
}

pub(crate) struct CheckedConnection {
    pub(crate) url: String,
    pub(crate) username: String,
}

impl ConnectionInput {
    fn address(&self) -> Result<Url, &'static str> {
        if self.kind != "webdav" {
            return Err("unsupported_type");
        }
        let url = parse_address(self.url.trim())?;
        if self.username.contains(['\r', '\n', '\0', ':'])
            || self.password.contains(['\r', '\n', '\0'])
            || (self.username.trim().is_empty() && !self.password.is_empty())
        {
            return Err("invalid_credentials");
        }
        Ok(url)
    }

    pub(crate) async fn check(self) -> Result<CheckedConnection, &'static str> {
        let url = self.address()?;
        let username = self.username.trim();
        let client = Client::builder()
            .redirect(Policy::none())
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|_| "operation_failed")?;
        let method = Method::from_bytes(b"PROPFIND").expect("valid WebDAV method");
        let mut request = client
            .request(method, url.clone())
            .header("Depth", "0")
            .header("Content-Type", "application/xml; charset=utf-8")
            .body(r#"<propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>"#);
        if !username.is_empty() {
            request = request.basic_auth(username, Some(&self.password));
        }
        let response = request.send().await.map_err(|error| {
            if error.is_timeout() {
                "connection_check_timeout"
            } else {
                "network_error"
            }
        })?;
        match response.status() {
            StatusCode::MULTI_STATUS => Ok(CheckedConnection {
                url: url.into(),
                username: username.into(),
            }),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err("invalid_credentials"),
            _ => Err("network_error"),
        }
    }
}

pub(crate) fn parse_address(address: &str) -> Result<Url, &'static str> {
    let (_, tail) = address.split_once("://").ok_or("invalid_url")?;
    let authority = tail.split(['/', '?', '#']).next().unwrap_or_default();
    if address.bytes().any(|byte| byte <= b' ' || byte == 0x7f)
        || address.contains(['\\', '#'])
        || authority.is_empty()
        || authority.contains('@')
    {
        return Err("invalid_url");
    }
    let url = Url::parse(address).map_err(|_| "invalid_url")?;
    if !matches!(url.scheme(), "http" | "https") || !url.has_host() {
        return Err("invalid_url");
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn draft(url: impl Into<String>) -> ConnectionInput {
        ConnectionInput {
            kind: "webdav".into(),
            url: url.into(),
            username: "user".into(),
            password: "pass".into(),
        }
    }

    #[test]
    fn accepts_http_webdav_path_and_rejects_ambiguous_or_credential_urls() {
        assert_eq!(
            draft(" https://example.test/dav/files/?token=sample ")
                .address()
                .unwrap()
                .path(),
            "/dav/files/"
        );
        for invalid in [
            "file:///dav",
            "http:example.test/dav",
            "https:///dav",
            "https://@example.test/dav",
            "https://user:pass@example.test/",
            "https://example.test/#",
        ] {
            assert_eq!(draft(invalid).address(), Err("invalid_url"));
        }
        let mut invalid_credentials = draft("https://example.test/dav");
        invalid_credentials.username = "ambiguous:user".into();
        assert_eq!(invalid_credentials.address(), Err("invalid_credentials"));
    }

    #[test]
    fn check_sends_one_read_only_webdav_probe_and_classifies_the_response() {
        for (status, expected) in [
            ("207 Multi-Status", Ok(())),
            ("401 Unauthorized", Err("invalid_credentials")),
            ("302 Found", Err("network_error")),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let authority = listener.local_addr().unwrap();
            let peer = thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut request = String::new();
                let mut reader = BufReader::new(&stream);
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap() == 0 || line == "\r\n" {
                        break;
                    }
                    request.push_str(&line);
                }
                assert!(request.starts_with("PROPFIND /webdav/path/?fixture=1 HTTP/1.1\r\n"));
                assert!(request.to_ascii_lowercase().contains("\r\ndepth: 0\r\n"));
                assert!(request.contains("authorization: Basic dXNlcjpwYXNz\r\n"));
                const EXPECTED_BODY: &[u8] =
                    br#"<propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>"#;
                let mut body = [0; EXPECTED_BODY.len()];
                reader.read_exact(&mut body).unwrap();
                assert_eq!(body.as_slice(), EXPECTED_BODY);
                write!(stream, "HTTP/1.1 {status}\r\nLocation: /other\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
            });
            let result = tauri::async_runtime::block_on(
                draft(format!("http://{authority}/webdav/path/?fixture=1")).check(),
            )
            .map(|_| ());
            assert_eq!(result, expected);
            peer.join().unwrap();
        }
    }
}
