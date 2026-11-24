import { useIsFocused } from 'expo-router/react-navigation';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { ExternalLink, GuideButton, GuidePanel, GuideScreen, GuideText, icons } from '../../guide';
import { useGuideState } from '../../guide-state';
import { fetchMinistryNews, ministryNewsUrl, readMinistryNewsCache } from '../../ministry-news';

const storageKey = 'nezlamnyi-ministry-news-v1';

function loadSavedNews() {
  try {
    return readMinistryNewsCache(Storage.getItemSync(storageKey));
  } catch {
    return [];
  }
}

export default function NewsScreen() {
  const { offline } = useGuideState();
  const focused = useIsFocused();
  const [items, setItems] = useState(loadSavedNews);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!focused || offline) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setStatus('loading');

    void fetchMinistryNews(controller.signal).then(news => {
      if (!active) return;
      setItems(news);
      setStatus('ready');
      // The current feed stays usable if local storage is unavailable.
      void Storage.setItem(storageKey, JSON.stringify(news)).catch(() => {});
    }, () => {
      if (active) setStatus('error');
    }).finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, focused, offline]);

  return (
    <GuideScreen title="Новини">
      <ExternalLink label="Новини Мінветеранів України" url={ministryNewsUrl} icon={icons.external} />
      {offline && <GuideText type="support" tone="foregroundMuted">
        {items.length ? 'Збережені новини' : 'Підключіться до інтернету, щоб завантажити новини.'}
      </GuideText>}
      {!offline && status === 'loading' && !items.length && <GuideText type="support" announcement>Завантажуємо новини…</GuideText>}
      {!offline && status === 'error' && <GuidePanel tone="surfaceSoft">
        <GuideText type="support" announcement>{items.length
          ? 'Не вдалося оновити новини. Показуємо збережені заголовки.' : 'Не вдалося завантажити новини Мінветеранів.'}</GuideText>
        <GuideButton label="Спробувати ще раз" onPress={() => setAttempt(value => value + 1)} />
      </GuidePanel>}
      {items.map(({ title, date, url, image }) => <GuidePanel key={url}>
        {!offline && image && <NewsPhoto key={image} uri={image} />}
        <GuideText type="meta" tone="foregroundMuted">{date}</GuideText>
        <GuideText type="section">{title}</GuideText>
        <ExternalLink label="Читати на сайті Мінветеранів" accessibilityLabel={`Читати: ${title}`} url={url} icon={icons.external} />
      </GuidePanel>)}
    </GuideScreen>
  );
}

function NewsPhoto({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <Image source={{ uri }} style={styles.image} resizeMode="cover" accessible={false} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
});
