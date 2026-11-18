import { Alert, MantineProvider, NativeSelect } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { createDemoBackend, scenarios, type Scenario } from './demo.ts';
import { translator } from './i18n.ts';
import { parsePreferences, type Preferences } from './preferences.ts';
import { theme } from './theme.ts';
import '@mantine/core/styles.css';
import './style.css';

function DevelopmentApp() {
  const [preferences, setPreferences] = useState(() => {
    try { return parsePreferences(localStorage.getItem('rclonekit-preferences')); }
    catch { return parsePreferences(null); }
  });
  const [preferenceError, setPreferenceError] = useState(false);
  const [scenario, setScenario] = useState<Scenario>(() => {
    const requested = new URL(location.href).searchParams.get('scenario');
    return scenarios.find(s => s === requested) ?? 'ready';
  });
  const backend = useMemo(() => createDemoBackend(scenario), [scenario]);
  const t = translator(preferences.language);
  useEffect(() => { document.documentElement.lang = preferences.language === 'zh' ? 'zh-CN' : 'en'; }, [preferences.language]);
  function savePreferences(next: Preferences) {
    setPreferences(next);
    try { localStorage.setItem('rclonekit-preferences', JSON.stringify(next)); setPreferenceError(false); }
    catch { setPreferenceError(true); }
  }
  return <MantineProvider theme={theme} defaultColorScheme="auto" forceColorScheme={preferences.theme === 'system' ? undefined : preferences.theme}>
    <div className="development-shell">
      <aside className="development-banner" aria-label={preferences.language === 'zh' ? '开发预览工具' : 'Development preview tools'}>
        <span>{t('demo')}</span><NativeSelect size="xs" aria-label={t('scenario')} value={scenario}
          data={scenarios.map(value => ({ value, label: t(value === 'restart' ? 'restartScenario' : value) }))}
          onChange={e => setScenario(e.currentTarget.value as Scenario)} />
      </aside>
      {preferenceError && <Alert color="red">{t('preferencesFailed')}</Alert>}
      <App key={scenario} backend={backend} preferences={preferences} savePreferences={savePreferences} />
    </div>
  </MantineProvider>;
}
createRoot(document.getElementById('root')!).render(<DevelopmentApp />);
