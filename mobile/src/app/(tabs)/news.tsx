import { useIsFocused } from 'expo-router/react-navigation';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, StyleSheet } from 'react-native';

import { GuideButton, GuidePanel, GuideScreen, GuideText } from '../../guide';
import { useGuideState } from '../../guide-state';
import { fetchNews, ministryNews, readNewsCache, sortNews, veteranNews, type NewsSource } from '../../news';

function loadSavedNews(source: NewsSource) {
  try {
    return readNewsCache(source, Storage.getItemSync(source.storageKey));
  } catch {
    return [];
  }
}

async function openArticle(url: string, offline: boolean) {
  if (offline) {
    Alert.alert('Для відкриття сайту потрібен інтернет');
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Не вдалося відкрити посилання');
  }
}

function useNewsFeed(source: NewsSource, enabled: boolean, attempt: number) {
  const [items, setItems] = useState(() => loadSavedNews(source));
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setStatus('loading');

    void fetchNews(source, controller.signal).then(news => {
      if (!active) return;
      setItems(news);
      setStatus('ready');
      // The current feed stays usable if local storage is unavailable.
      void Storage.setItem(source.storageKey, JSON.stringify(news)).catch(() => {});
    }, () => {
      if (active) setStatus('error');
    }).finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, enabled, source]);

  return { source, items, status };
}

export default function NewsScreen() {
  const { offline } = useGuideState();
  const focused = useIsFocused();
  const [attempt, setAttempt] = useState(0);
  const enabled = focused && !offline;
  const ministry = useNewsFeed(ministryNews, enabled, attempt);
  const veteran = useNewsFeed(veteranNews, enabled, attempt);
  const feeds = [ministry, veteran];
  const items = sortNews(feeds.flatMap(({ source, items }) => items.map(item => ({ ...item, source }))));
  const loading = feeds.some(feed => feed.status === 'loading');
  const failed = feeds.some(feed => feed.status === 'error');

  return (
    <GuideScreen title="Новини">
      {offline && <GuideText type="support" tone="foregroundMuted">
        {items.length ? 'Збережені новини' : 'Підключіться до інтернету, щоб завантажити новини.'}
      </GuideText>}
      {!offline && loading && !items.length && <GuideText type="support" announcement>Завантажуємо новини…</GuideText>}
      {!offline && !loading && failed && <GuidePanel tone="surfaceSoft">
        <GuideText type="support" announcement>{items.length
          ? 'Не вдалося оновити всі новини.' : 'Не вдалося завантажити новини.'}</GuideText>
        <GuideButton label="Спробувати ще раз" onPress={() => setAttempt(value => value + 1)} />
      </GuidePanel>}
      {items.map(({ title, date, url, image, source }) => <GuidePanel key={url}
        accessibilityLabel={`${source.name}. ${title}`}
        onPress={() => { void openArticle(url, offline); }}>
        {!offline && image && <NewsPhoto key={image} uri={image} />}
        <GuideText type="meta" tone="foregroundMuted">{date}</GuideText>
        <GuideText type="item" heading>{title}</GuideText>
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
