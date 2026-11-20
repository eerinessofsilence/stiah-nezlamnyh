import { requireNativeView } from 'expo';
import { Platform, type ColorValue, type ViewProps } from 'react-native';

export const StatusEdge = Platform.OS === 'ios'
  ? requireNativeView<ViewProps & { materialTint: ColorValue }>('GuideEdgeBlur')
  : null;
