import { StyleSheet } from 'react-native';

export const guideFonts = {
  GuideRegular: require('../assets/fonts/e-Ukraine-Regular.otf'),
  GuideMedium: require('../assets/fonts/e-Ukraine-Medium.otf'),
  GuideBold: require('../assets/fonts/e-Ukraine-Bold.otf'),
};

export const typography = StyleSheet.create({
  title: { fontFamily: 'GuideRegular', fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  sheetTitle: { fontFamily: 'GuideRegular', fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  section: { fontFamily: 'GuideMedium', fontSize: 20, lineHeight: 26 },
  item: { fontFamily: 'GuideMedium', fontSize: 16, lineHeight: 22 },
  body: { fontFamily: 'GuideRegular', fontSize: 16, lineHeight: 24 },
  tile: { fontFamily: 'GuideMedium', fontSize: 14, lineHeight: 20 },
  support: { fontFamily: 'GuideRegular', fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: 'GuideRegular', fontSize: 12, lineHeight: 16 },
  number: { fontFamily: 'GuideMedium', fontSize: 12, lineHeight: 16 },
});
