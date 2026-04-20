import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

interface StatItemProps {
  value: string;
  label: string;
  theme: LandingTheme;
}

interface StatsSectionProps {
  theme: LandingTheme;
}

const StatItem: React.FC<StatItemProps> = ({ value, label, theme }) => {
  const colors = landingThemeTokens[theme];

  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
};

const StatsSection: React.FC<StatsSectionProps> = ({ theme }) => {
  const colors = landingThemeTokens[theme];

  return (
    <View style={styles.container}>
      <Text style={[styles.transitionText, { color: colors.textSecondary }]}>
        {'很高兴遇见你！因为你的加入，我们更加温暖和有趣——'}
      </Text>
      <View style={styles.statsRow}>
        <StatItem value="381032" label="Users" theme={theme} />
        <StatItem value="5289" label="CloudApps" theme={theme} />
        <StatItem value="2319" label="Authentic Apps" theme={theme} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  transitionText: {
    fontFamily: Platform.OS === 'web' ? "'PingFang SC', sans-serif" : undefined,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    maxWidth: 900,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 160,
    paddingHorizontal: 24,
  },
  statValue: {
    fontFamily: Platform.OS === 'web' ? "'PingFang SC', sans-serif" : undefined,
    fontSize: 36,
    fontWeight: '400',
  },
  statLabel: {
    fontFamily: Platform.OS === 'web' ? "'PingFang SC', sans-serif" : undefined,
    fontSize: 24,
    fontWeight: '400',
    marginTop: 4,
  },
});

export default StatsSection;
