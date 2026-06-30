import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import type { PostCardData } from '@/lib/queries';

// Radial button positions (arc above the thumbnail hub)
// Standard math coords (0° = right, CCW). In screen coords dy = -R*sin(angle).
const RADIUS = 82;
const BUTTONS = [
  {
    key: 'like',
    angle: 150,
    icon: 'heart' as const,
    activeIcon: 'heart' as const,
    label: 'Like',
    color: '#FF375F',
    activeColor: '#FF375F',
  },
  {
    key: 'pin',
    angle: 90,
    icon: 'bookmark-outline' as const,
    activeIcon: 'bookmark' as const,
    label: 'Pin',
    color: theme.primary,
    activeColor: theme.primary,
  },
  {
    key: 'delete',
    angle: 30,
    icon: 'trash-outline' as const,
    activeIcon: 'trash' as const,
    label: 'Delete',
    color: theme.danger,
    activeColor: theme.danger,
  },
] as const;

function toScreen(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: RADIUS * Math.cos(rad),
    y: -RADIUS * Math.sin(rad),
  };
}

interface Props {
  post: PostCardData | null;
  isOwner: boolean;
  vibbedByMe: boolean;
  onClose: () => void;
  onVib: () => void;
  onPin: () => void;
  onDelete: () => void;
}

export function PostRadialMenu({ post, isOwner, vibbedByMe, onClose, onVib, onPin, onDelete }: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const hubAnim = useRef(new Animated.Value(0)).current;
  const btnAnims = useRef(BUTTONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!post) return;

    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(hubAnim, { toValue: 1, tension: 220, friction: 10, useNativeDriver: true }),
      ...btnAnims.map((anim, i) =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 200,
          friction: 9,
          delay: i * 35,
          useNativeDriver: true,
        })
      ),
    ]).start();

    return () => {
      backdropAnim.setValue(0);
      hubAnim.setValue(0);
      btnAnims.forEach((a) => a.setValue(0));
    };
  }, [post]);

  if (!post) return null;

  const buttons = BUTTONS.filter((b) => b.key !== 'delete' || isOwner);

  return (
    <Modal visible animationType="none" transparent onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />

      {/* Dismiss tapping outside */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Radial hub (centered on screen) */}
      <View style={styles.hub} pointerEvents="box-none">
        {/* Arc buttons */}
        {buttons.map((btn, i) => {
          const { x, y } = toScreen(btn.angle);
          const isActive = btn.key === 'like' ? vibbedByMe : false;

          return (
            <Animated.View
              key={btn.key}
              style={[
                styles.btnWrap,
                {
                  transform: [
                    {
                      translateX: btnAnims[BUTTONS.findIndex((b) => b.key === btn.key)].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, x],
                      }),
                    },
                    {
                      translateY: btnAnims[BUTTONS.findIndex((b) => b.key === btn.key)].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, y],
                      }),
                    },
                    {
                      scale: btnAnims[BUTTONS.findIndex((b) => b.key === btn.key)].interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 1.12, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  if (btn.key === 'like') onVib();
                  else if (btn.key === 'pin') onPin();
                  else if (btn.key === 'delete') onDelete();
                }}
                style={[
                  styles.actionBtn,
                  { borderColor: isActive ? btn.activeColor : 'rgba(255,255,255,0.15)' },
                  isActive && { backgroundColor: `${btn.activeColor}22` },
                ]}
              >
                <Ionicons
                  name={isActive ? btn.activeIcon : btn.icon}
                  size={22}
                  color={isActive ? btn.activeColor : '#FFF'}
                />
              </Pressable>
              <Text style={[styles.btnLabel, isActive && { color: btn.activeColor }]}>
                {btn.label}
              </Text>
            </Animated.View>
          );
        })}

        {/* Thumbnail hub */}
        <Animated.View
          style={[
            styles.thumbnail,
            {
              transform: [
                {
                  scale: hubAnim.interpolate({
                    inputRange: [0, 0.6, 1],
                    outputRange: [0, 1.08, 1],
                  }),
                },
              ],
              opacity: hubAnim,
            },
          ]}
        >
          <Image source={{ uri: post.photo_url }} style={styles.thumbnailImg} />
        </Animated.View>

        {/* X button below thumbnail */}
        <Animated.View
          style={[
            styles.closeBtnWrap,
            {
              opacity: hubAnim,
              transform: [
                {
                  scale: hubAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  hub: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 90,
    height: 90,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  thumbnailImg: { width: '100%', height: '100%' },

  btnWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 5,
  },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  closeBtnWrap: {
    position: 'absolute',
    top: 110,
    alignItems: 'center',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
