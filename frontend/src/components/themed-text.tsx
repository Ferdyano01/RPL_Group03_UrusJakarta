import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, Palette, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
  },
  default: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  link: {
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  linkPrimary: {
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '800',
    color: Palette.accent,
    textDecorationLine: 'underline',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '700',
    fontSize: 12,
  },
});
