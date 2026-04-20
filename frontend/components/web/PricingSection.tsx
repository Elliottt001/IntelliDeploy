import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { landingThemeTokens, type LandingTheme } from './landingTheme';

interface PlanFeature { text: string }
interface PlanData {
  title: string;
  description: string;
  price: string;
  features: PlanFeature[];
}
interface PricingSectionProps { theme: LandingTheme }

const lightPlans: PlanData[] = [
  {
    title: 'Mindful Start',
    description: 'A simple way to begin your journey toward better emotional awareness.',
    price: '$8',
    features: [
      { text: 'Daily mood check-ins' },
      { text: 'Guided reflections and affirmations' },
      { text: 'Personalized mood insights' },
      { text: 'Breathing and mindfulness tools' },
      { text: 'Secure journal storage' },
      { text: 'Light reminders for routine care' },
    ],
  },
  {
    title: 'Deep Clarity',
    description: 'Go deeper with insights, reflections, and tools designed for emotional growth.',
    price: '$24',
    features: [
      { text: 'Everything in Mindful Start' },
      { text: 'AI-powered emotion tracking' },
      { text: 'Custom journaling prompts' },
      { text: 'Mood-to-action recommendations' },
      { text: 'Weekly emotional report' },
      { text: 'Sync across all devices' },
    ],
  },
];

const darkPlan: PlanData = {
  title: 'Calm Pro',
  description: 'For those ready to fully commit to their mental well-being and daily reflection.',
  price: '$59',
  features: [
    { text: 'Everything in Deep Clarity' },
    { text: 'One-on-one journaling feedback' },
    { text: 'Audio reflections and meditation access' },
    { text: 'Unlimited data history' },
    { text: 'Early access to mood studies' },
  ],
};

// The decorative blurred SVG icon used in feature check boxes
const FeatureIconSVG = () => (
  <svg width="53" height="43" viewBox="0 0 53 43" fill="none" style={{ position: 'absolute', left: -3, top: -5, pointerEvents: 'none' }}>
    <g filter="url(#fi_f0)">
      <path d="M14.5196 3.25848C14.5477 3.20716 14.5864 3.1371 14.6332 3.05433C14.6901 3.85677 15.0846 4.77929 15.4275 5.46762C15.9283 6.47301 17.6347 7.2836 18.6463 7.64914C19.8009 8.06634 21.0342 8.90791 22.0577 9.56833C23.8182 10.7043 24.2779 11.6725 23.0343 13.5448C21.4947 15.8628 17.3703 15.8252 15.2624 14.4146C12.7673 12.745 12.9448 10.4877 13.1578 7.81483C13.2784 6.30115 13.794 4.58279 14.5196 3.25848Z" fill="#FFAFDC"/>
    </g>
    <g filter="url(#fi_f1)">
      <path d="M43.7576 9.02525C43.8116 9.00274 43.8855 8.97217 43.9738 8.93677C43.517 9.59897 43.2487 10.5657 43.0865 11.3174C42.8495 12.4154 43.6756 14.1143 44.2372 15.0317C44.8781 16.0787 45.3155 17.5063 45.7021 18.6614C46.3672 20.6482 46.1214 21.6914 43.9807 22.3766C41.3304 23.2249 38.1333 20.619 37.3684 18.2008C36.4631 15.3383 38.0118 13.6866 39.8479 11.7324C40.8877 10.6258 42.3637 9.60605 43.7576 9.02525Z" fill="#97DEFF"/>
    </g>
    <g filter="url(#fi_f2)">
      <path d="M1.47469 4.97039C1.50281 4.91908 1.54144 4.84901 1.58824 4.76624C1.64522 5.56869 2.03968 6.4912 2.38256 7.17953C2.88339 8.18493 4.58978 8.99551 5.60138 9.36106C6.75594 9.77825 7.98929 10.6198 9.01278 11.2802C10.7732 12.4162 11.233 13.3844 9.98943 15.2567C8.44982 17.5748 4.32541 17.5371 2.2175 16.1265C-0.277653 14.4569 -0.100152 12.1997 0.112884 9.52674C0.233526 8.01306 0.749035 6.2947 1.47469 4.97039Z" fill="#FFCC91"/>
    </g>
    <g filter="url(#fi_f3)">
      <path d="M31.467 22.8306C32.1164 22.6151 32.9949 22.2733 33.8659 22.1033C34.2252 21.6196 34.7174 21.2862 35.4079 21.2951C38.1111 21.33 41.2125 21.264 43.8296 21.9591C46.6307 22.7031 50.6121 24.6681 51.5959 27.675C52.7056 31.0664 46.2431 30.0349 44.8963 29.6672C42.7729 29.0876 37.0093 27.5908 35.9931 30.5359C35.1653 32.9351 37.1284 35.7017 33.4662 35.8663C30.6228 35.9941 28.5815 33.409 26.9038 31.5042C25.6632 30.0958 25.203 28.5647 26.0941 26.8432C27.0665 24.9647 29.5703 23.4601 31.467 22.8306Z" fill="#A3B2FF"/>
    </g>
    <defs>
      <filter id="fi_f0" x="2.35" y="-7.64" width="32.07" height="33.72" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="s"/><feGaussianBlur stdDeviation="5.35" result="e"/>
      </filter>
      <filter id="fi_f1" x="26.41" y="-1.75" width="30.31" height="34.99" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="s"/><feGaussianBlur stdDeviation="5.35" result="e"/>
      </filter>
      <filter id="fi_f2" x="-10.69" y="-5.92" width="32.07" height="33.72" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="s"/><feGaussianBlur stdDeviation="5.35" result="e"/>
      </filter>
      <filter id="fi_f3" x="14.94" y="10.60" width="47.48" height="35.96" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="s"/><feGaussianBlur stdDeviation="5.35" result="e"/>
      </filter>
    </defs>
  </svg>
);

// Feature check icon: colored blurred SVG + white square + checkmark
const CheckIconBox = () => {
  if (Platform.OS !== 'web') {
    return (
      <View style={s.checkOuter}>
        <View style={s.checkInner}>
          <Text style={{ fontSize: 10, color: '#404040', fontWeight: '700' }}>✓</Text>
        </View>
      </View>
    );
  }
  return (
    <div style={{
      display: 'flex', padding: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 5,
      border: '0.4px solid rgba(124,98,255,0.14)', background: 'linear-gradient(180deg, rgba(236,240,255,0.96) 0%, rgba(226,232,255,0.9) 100%)',
      overflow: 'hidden', position: 'relative', flexShrink: 0,
      width: 16, height: 16,
    }}>
      <FeatureIconSVG />
      <div style={{
        display: 'flex', width: 15, height: 15, justifyContent: 'center',
        alignItems: 'center', borderRadius: 3, background: 'rgba(255,255,255,0.96)',
        boxShadow: '0 2px 5px 0 rgba(74,84,152,0.08), 0 -0.4px 0.8px 0 rgba(84,92,148,0.14) inset, 0 0.8px 0.4px 0 #FFF inset',
        position: 'relative', zIndex: 1, flexShrink: 0,
      }}>
        <svg width="7" height="7" viewBox="0 0 15 15" fill="none">
          <path d="M2.21191 7.96284L5.30856 11.0595L12.3866 3.98145" stroke="#5A50CF" strokeWidth="2.36" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
};

// Caret right arrow
const CaretRight = ({ color = 'white' }: { color?: string }) => {
  if (Platform.OS !== 'web') return null;
  return (
    <svg width="22" height="22" viewBox="0 0 29 29" fill="none" style={{ marginLeft: 10, flexShrink: 0 }}>
      <path d="M20.3049 13.675L11.3628 4.73296C11.2377 4.60776 11.0783 4.52249 10.9048 4.48792C10.7312 4.45336 10.5513 4.47107 10.3879 4.53881C10.2244 4.60655 10.0847 4.72127 9.98641 4.86845C9.88817 5.01563 9.8358 5.18865 9.83594 5.36561V23.2498C9.8358 23.4267 9.88817 23.5997 9.98641 23.7469C10.0847 23.8941 10.2244 24.0088 10.3879 24.0766C10.5513 24.1443 10.7312 24.162 10.9048 24.1274C11.0783 24.0929 11.2377 24.0076 11.3628 23.8824L20.3049 14.9403C20.388 14.8573 20.454 14.7587 20.499 14.6501C20.544 14.5416 20.5671 14.4252 20.5671 14.3077C20.5671 14.1902 20.544 14.0738 20.499 13.9653C20.454 13.8567 20.388 13.7581 20.3049 13.675Z" fill={color} fillOpacity="0.85"/>
    </svg>
  );
};

// ─── Light Plan Card ──────────────────────────────────────────────────────────
const LightPlanCard = ({ plan, billingCycle }: { plan: PlanData; billingCycle: 'monthly' | 'yearly' }) => {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', padding: 18, gap: 24,
        borderRadius: 30, background: 'linear-gradient(180deg, rgba(233, 239, 255, 0.78) 0%, rgba(244, 241, 255, 0.82) 100%)',
        border: '1px solid rgba(124, 98, 255, 0.12)',
      }}>
        {/* Inner white card */}
        <div style={{
          display: 'flex', flexDirection: 'column', padding: 12, gap: 16,
          borderRadius: 24, background: 'rgba(255,255,255,0.94)',
          boxShadow: '0 0 1px 0 rgba(175,183,224,0.24), 0 10px 24px 0 rgba(95,110,184,0.06)',
          overflow: 'hidden', position: 'relative',
        }}>
          {/* Gradient glow background */}
          <svg style={{ position: 'absolute', right: -180, bottom: -210, filter: 'blur(91px)', pointerEvents: 'none' }}
            width="813" height="734" viewBox="0 0 813 734" fill="none">
            <g filter="url(#lglow)">
              <path d="M641.183 73.8973C717.774 181.857 674.783 413.281 558.001 496.132C441.218 578.982 109.562 572.124 32.971 464.164C-43.6204 356.204 283.494 295.453 400.276 212.602C517.058 129.752 564.592 -34.0624 641.183 73.8973Z" fill="url(#lglow_g)"/>
            </g>
            <defs>
              <filter id="lglow" x="-160" y="-144" width="1022" height="878" filterUnits="userSpaceOnUse">
                <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg"/><feGaussianBlur stdDeviation="91"/>
              </filter>
              <linearGradient id="lglow_g" x1="489" y1="157" x2="357" y2="471" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E3EAFF"/>
                <stop offset="0.5" stopColor="#D7CCFF"/>
                <stop offset="1" stopColor="#BFD4FF"/>
              </linearGradient>
            </defs>
          </svg>
          {/* Details area */}
          <div style={{
            display: 'flex', flexDirection: 'column', padding: 32, gap: 52,
            borderRadius: 20, border: '1px solid rgba(228, 232, 255, 0.88)', background: 'linear-gradient(180deg, rgba(252, 253, 255, 0.98) 0%, rgba(245, 247, 255, 0.96) 100%)',
            boxShadow: '0 -4px 4px 0 rgba(255,255,255,0.28) inset, 0 0 1px 0 rgba(175,183,224,0.22)',
            overflow: 'hidden', position: 'relative',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontFamily: "'Ibarra Real Nova', Georgia, serif", fontWeight: 600, fontSize: 28, color: '#1F0B4C', lineHeight: '120%', letterSpacing: -0.56 }}>{plan.title}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 17, color: '#666D80', lineHeight: '150%', letterSpacing: -0.14 }}>{plan.description}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 13 }}>
                <span style={{ fontFamily: "'Ibarra Real Nova', Georgia, serif", fontWeight: 400, fontSize: 42, color: '#1F0B4C', lineHeight: '120%', letterSpacing: -0.84 }}>{plan.price}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: '#666D80' }}>/ {billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
            </div>
            {/* Purple gradient button */}
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '18px 24px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(180deg, #7157F4 0%, #8A73FF 100%)',
              boxShadow: '0 18px 28px 0 rgba(124,98,255,0.22), 0 6px 12px 0 rgba(61,78,164,0.12), 0 2px 5px 0 rgba(0,0,0,0.08)',
            }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: '#FFF', textTransform: 'capitalize' }}>Choose plan</span>
              <CaretRight color="white" />
            </button>
          </div>
        </div>
        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 28px', gap: 14 }}>
          {plan.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <CheckIconBox />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 17, color: '#15161E', lineHeight: '120%', letterSpacing: -0.28 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Native fallback
  return (
    <View style={s.lightCardNative}>
      <Text style={s.nativeTitle}>{plan.title}</Text>
      <Text style={s.nativeDesc}>{plan.description}</Text>
      <View style={s.priceRow}>
        <Text style={s.nativePrice}>{plan.price}</Text>
        <Text style={s.nativePeriod}> / {billingCycle === 'monthly' ? 'month' : 'year'}</Text>
      </View>
      <TouchableOpacity style={s.nativeBtn}><Text style={s.nativeBtnText}>Choose plan</Text></TouchableOpacity>
      {plan.features.map((f, i) => (
        <View key={i} style={s.featureRow}>
          <View style={s.checkOuter}><View style={s.checkInner}><Text style={{ fontSize: 10, color: '#404040' }}>✓</Text></View></View>
          <Text style={s.nativeFeatureText}>{f.text}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── Dark Plan Card (Calm Pro) ────────────────────────────────────────────────
const DarkPlanCard = ({ plan, billingCycle }: { plan: PlanData; billingCycle: 'monthly' | 'yearly' }) => {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'row', padding: 18, gap: 16,
        borderRadius: 30, background: 'linear-gradient(180deg, rgba(12, 18, 40, 0.98) 0%, rgba(16, 22, 48, 0.96) 100%)', border: '1px solid rgba(156, 139, 255, 0.18)',
        boxShadow: '0 24px 60px rgba(3, 8, 24, 0.28)',
        flex: 1,
      }}>
        {/* Left: price card with radial gradient */}
        <div style={{
          display: 'flex', flexDirection: 'column', padding: 12, borderRadius: 30,
          background: 'radial-gradient(100% 100% at 50% 0%, rgba(118, 122, 255, 0.58) 0%, rgba(34, 42, 92, 0.92) 68.39%)',
          minWidth: 550,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', padding: 32, gap: 80,
            borderRadius: 20, background: 'linear-gradient(180deg, rgba(20, 28, 62, 0.96) 0%, rgba(18, 24, 54, 0.98) 100%)',
            overflow: 'hidden', position: 'relative', flex: 1,
          }}>
            {/* Background glow SVG */}
            <svg style={{ position: 'absolute', right: -120, top: -310, pointerEvents: 'none' }}
              width="867" height="1123" viewBox="0 0 867 1123" fill="none">
              <g filter="url(#dg0)">
                <ellipse cx="93" cy="177" rx="93" ry="177" transform="matrix(-0.646 0.765 0.413 0.910 150 222)" fill="white"/>
              </g>
              <g filter="url(#dg1)">
                <ellipse cx="112" cy="227" rx="112" ry="227" transform="matrix(0.303 0.952 0.769 -0.641 291 424)" fill="#8C76FF"/>
              </g>
              <defs>
                <filter id="dg0" x="-109" y="101" width="543" height="706" filterUnits="userSpaceOnUse">
                  <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg"/><feGaussianBlur stdDeviation="88"/>
                </filter>
                <filter id="dg1" x="145" y="28" width="709" height="714" filterUnits="userSpaceOnUse">
                  <feFlood floodOpacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg"/><feGaussianBlur stdDeviation="88"/>
                </filter>
              </defs>
            </svg>
            {/* Title + price */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
              <span style={{ fontFamily: "'Ibarra Real Nova', Georgia, serif", fontWeight: 600, fontSize: 28, color: '#FFF', lineHeight: '120%', letterSpacing: -0.56 }}>{plan.title}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 13 }}>
                <span style={{ fontFamily: "'Ibarra Real Nova', Georgia, serif", fontWeight: 400, fontSize: 42, color: '#FFF', lineHeight: '120%', letterSpacing: -0.84 }}>{plan.price}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>/ {billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
            </div>
            {/* Light button with colorful glow */}
            <div style={{ position: 'relative' }}>
              {/* Glow blobs */}
              <svg style={{ position: 'absolute', left: 140, top: -90, filter: 'blur(53px)', pointerEvents: 'none', opacity: 0.4 }} width="107" height="154" viewBox="0 0 107 154" fill="none">
                <path d="M14.7287 32.5445C15.0095 32.0319 15.3954 31.3322 15.8628 30.5055C16.4319 38.52 20.3716 47.7338 23.7962 54.6086C28.7982 64.6501 45.841 72.7459 55.9445 76.3968C67.4758 80.5636 79.794 88.9689 90.0163 95.565C107.599 106.91 112.191 116.58 99.7707 135.28C84.3937 158.432 43.2006 158.056 22.1475 143.968C-2.77309 127.292 -1.00028 104.748 1.12744 78.0516C2.33238 62.9336 7.48109 45.7712 14.7287 32.5445Z" fill="#FFAFDC"/>
              </svg>
              <svg style={{ position: 'absolute', right: -40, top: -46, filter: 'blur(53px)', pointerEvents: 'none', opacity: 0.4 }} width="180" height="187" viewBox="0 0 180 187" fill="none">
                <path d="M87.2267 34.6139C87.7662 34.3891 88.5047 34.0837 89.3861 33.7302C84.8238 40.344 82.1445 49.9999 80.524 57.5075C78.157 68.4734 86.4078 85.4417 92.0166 94.6042C98.4181 105.061 102.786 119.32 106.648 130.856C113.29 150.7 110.836 161.119 89.455 167.962C62.9847 176.435 31.0533 150.408 23.4143 126.256C14.3719 97.6662 29.8395 81.1694 48.1779 61.6524C58.563 50.5999 73.3046 40.4148 87.2267 34.6139Z" fill="#97DEFF"/>
              </svg>
              <svg style={{ position: 'absolute', left: 40, top: -77, filter: 'blur(53px)', pointerEvents: 'none', opacity: 0.4 }} width="107" height="154" viewBox="0 0 107 154" fill="none">
                <path d="M14.7287 32.5445C15.0095 32.0319 15.3954 31.3322 15.8628 30.5055C16.4319 38.52 20.3716 47.7338 23.7962 54.6086C28.7982 64.6501 45.841 72.7459 55.9445 76.3968C67.4758 80.5636 79.794 88.9689 90.0163 95.565C107.599 106.91 112.191 116.58 99.7707 135.28C84.3937 158.432 43.2006 158.056 22.1475 143.968C-2.77309 127.292 -1.00028 104.748 1.12744 78.0516C2.33238 62.9336 7.48109 45.7712 14.7287 32.5445Z" fill="#FFCC91"/>
              </svg>
              <button style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px 28px', borderRadius: 16, border: '1px solid rgba(159,174,255,0.12)',
                background: 'rgba(244, 246, 255, 0.96)', cursor: 'pointer', position: 'relative', zIndex: 1,
                boxShadow: '0 8px 17px 0 rgba(20,26,64,0.16), 0 -1px 2px 0 rgba(0,0,0,0.14) inset, 0 2px 1px 0 rgba(255,255,255,0.9) inset',
                width: '100%',
              }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: '#404040', textTransform: 'capitalize' }}>Choose Plan</span>
                <CaretRight color="#404040" />
              </button>
            </div>
          </div>
        </div>
        {/* Right: description + features */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 48px', gap: 24, flex: 1, justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 18, color: 'rgba(255,255,255,0.9)', lineHeight: '160%', letterSpacing: -0.14 }}>{plan.description}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plan.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <CheckIconBox />
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 17, color: 'rgba(255,255,255,0.8)', lineHeight: '120%', letterSpacing: -0.28 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  // Native fallback
  return (
    <View style={[s.lightCardNative, { backgroundColor: '#252525' }]}>
      <Text style={[s.nativeTitle, { color: '#FFF' }]}>{plan.title}</Text>
      <View style={s.priceRow}>
        <Text style={[s.nativePrice, { color: '#FFF' }]}>{plan.price}</Text>
        <Text style={[s.nativePeriod, { color: 'rgba(255,255,255,0.6)' }]}> / {billingCycle === 'monthly' ? 'month' : 'year'}</Text>
      </View>
      <TouchableOpacity style={[s.nativeBtn, { backgroundColor: '#ECECEC' }]}><Text style={[s.nativeBtnText, { color: '#404040' }]}>Choose Plan</Text></TouchableOpacity>
      {plan.features.map((f, i) => (
        <View key={i} style={s.featureRow}>
          <View style={s.checkOuter}><View style={s.checkInner}><Text style={{ fontSize: 10, color: '#404040' }}>✓</Text></View></View>
          <Text style={[s.nativeFeatureText, { color: 'rgba(255,255,255,0.8)' }]}>{f.text}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── Main Section ─────────────────────────────────────────────────────────────
export default function PricingSection({ theme }: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const colors = landingThemeTokens[theme];
  const isDark = theme === 'dark';

  if (Platform.OS === 'web') {
    return (
      <div style={{
        width: '100%', maxWidth: 1200, margin: '0 auto',
        padding: '80px 48px', display: 'flex', flexDirection: 'column', gap: 48,
        position: 'relative',
      }}>
        {/* Background glow: purple circle top right */}
        <svg style={{ position: 'absolute', right: -100, top: -80, opacity: 0.18, filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 } as any}
          width="560" height="560" viewBox="0 0 560 560" fill="none">
          <circle cx="280" cy="280" r="280" fill="#C8D5FF"/>
        </svg>
        {/* Background glow: pink ellipse top right */}
        <svg style={{ position: 'absolute', right: 0, top: -20, opacity: 0.2, filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 } as any}
          width="420" height="380" viewBox="0 0 420 380" fill="none">
          <ellipse cx="300" cy="140" rx="200" ry="170" fill="#D9CCFF"/>
        </svg>
        {/* Moon / atmosphere decoration top right */}
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
          {/* Pill badge */}
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start',
            padding: '8px 16px', borderRadius: 100,
            border: isDark ? '1px solid rgba(156, 139, 255, 0.26)' : '1px solid rgba(124, 98, 255, 0.18)', background: isDark ? 'rgba(156, 139, 255, 0.12)' : 'rgba(255,255,255,0.56)',
            backdropFilter: 'blur(3px)',
            boxShadow: isDark ? '0 10px 24px rgba(2, 6, 20, 0.2)' : '0 2px 4px 0 rgba(183,183,183,0.18)',
          }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: isDark ? '#D8D1FF' : '#5A50CF' }}>Pricing Plan</span>
          </div>
          {/* Title */}
          <h2 style={{
            fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 36,
            color: isDark ? colors.textPrimary : '#1F0B4C',
            lineHeight: '130%', letterSpacing: -1.2, margin: 0,
            whiteSpace: 'pre-line',
          }}>{'若有高阶需求，即刻订阅\n获得至尊级体验'}</h2>
          {/* Subtitle */}
          <p style={{
            fontFamily: "'Inter', 'PingFang SC', sans-serif", fontWeight: 400, fontSize: 15,
            color: isDark ? colors.textSecondary : '#666D80',
            lineHeight: '190%', letterSpacing: -0.15, margin: 0,
          }}>{'我们照顾每一种需求，定制了不同付费体验。用户可以自由选择体验的深度。现在订阅即可享受10%天使折扣！'}</p>
          {/* Toggle */}
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start',
            padding: 8, borderRadius: 100,
            border: isDark ? '1px solid rgba(156, 139, 255, 0.18)' : '1px solid rgba(124, 98, 255, 0.16)', background: isDark ? 'rgba(16, 21, 44, 0.7)' : 'rgba(255,255,255,0.5)',
            boxShadow: isDark ? '0 12px 28px rgba(3, 8, 24, 0.22)' : '0 9px 20px 0 rgba(141,141,141,0.18)',
            backdropFilter: 'blur(6px)',
          }}>
            {(['monthly', 'yearly'] as const).map((cycle) => (
              <button key={cycle} onClick={() => setBillingCycle(cycle)} style={{
                padding: '10px 28px', borderRadius: 100, border: 'none', cursor: 'pointer',
                background: billingCycle === cycle
                  ? (isDark ? 'linear-gradient(180deg, #8B79FF 0%, #6A74FF 100%)' : '#7C62FF')
                  : 'transparent',
                boxShadow: billingCycle === cycle
                  ? (isDark ? '0 8px 18px rgba(83, 95, 255, 0.26)' : '0 4px 10px rgba(124, 98, 255, 0.18)')
                  : 'none',
                outline: billingCycle === cycle
                  ? (isDark ? '1px solid rgba(216, 222, 255, 0.08)' : '2px solid rgba(255,255,255,0.92)')
                  : 'none',
              }}>
                <span style={{
                  fontFamily: "'Geist', 'Inter', sans-serif", fontWeight: 500, fontSize: 15,
                  color: billingCycle === cycle
                    ? 'rgba(255,255,255,0.92)'
                    : (isDark ? 'rgba(227, 232, 255, 0.7)' : '#667085'),
                }}>{cycle === 'monthly' ? 'Monthly' : 'Yearly'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', zIndex: 1 }}>
          {/* Top row: two light cards side by side */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {lightPlans.map((plan, i) => (
              <div key={i} style={{ flex: 1, minWidth: 280 }}>
                <LightPlanCard plan={plan} billingCycle={billingCycle} />
              </div>
            ))}
          </div>
          {/* Bottom: dark card full width */}
          <DarkPlanCard plan={darkPlan} billingCycle={billingCycle} />
        </div>
      </div>
    );
  }

  // Native fallback
  return (
    <View style={s.container}>
      <Text style={[s.nativeTitle, { color: colors.textPrimary, fontSize: 36, marginBottom: 8 }]}>
        {'若有高阶需求，即刻订阅\n获得至尊级体验'}
      </Text>
      <Text style={[s.nativeDesc, { color: colors.textSecondary, marginBottom: 32 }]}>
        {'我们照顾每一种需求，定制了不同付费体验。'}
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 32, borderRadius: 100, borderWidth: 2, borderColor: '#FFF', padding: 6, alignSelf: 'flex-start' }}>
        {(['monthly', 'yearly'] as const).map((cycle) => (
          <TouchableOpacity key={cycle} onPress={() => setBillingCycle(cycle)}
            style={{ paddingVertical: 8, paddingHorizontal: 20, borderRadius: 100, backgroundColor: billingCycle === cycle ? '#7C62FF' : 'transparent' }}>
            <Text style={{ color: billingCycle === cycle ? '#FFF' : '#667085', fontWeight: '500', fontSize: 16 }}>
              {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {lightPlans.map((plan, i) => <LightPlanCard key={i} plan={plan} billingCycle={billingCycle} />)}
      <DarkPlanCard plan={darkPlan} billingCycle={billingCycle} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%' as any, padding: 24, alignItems: 'flex-start' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  checkOuter: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#ECECEC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkInner: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#F8F8F8', alignItems: 'center', justifyContent: 'center' },
  lightCardNative: { borderRadius: 24, padding: 20, backgroundColor: 'rgba(243,243,243,0.77)', marginBottom: 20 },
  nativeTitle: { fontWeight: '600', fontSize: 32, color: '#1F0B4C', marginBottom: 8 },
  nativeDesc: { fontSize: 16, color: '#666D80', lineHeight: 24, marginBottom: 16 },
  nativePrice: { fontSize: 48, fontWeight: '400', color: '#1F0B4C' },
  nativePeriod: { fontSize: 15, color: '#666D80', marginBottom: 6 },
  nativeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#7C62FF', marginVertical: 16 },
  nativeBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  nativeFeatureText: { fontSize: 16, fontWeight: '500', color: '#15161E', flex: 1 },
});
