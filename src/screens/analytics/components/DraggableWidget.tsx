import React from 'react';
import { View, StyleSheet, PanResponder, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DraggableWidgetProps {
  children: React.ReactNode;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (y: number) => void;
  isDragging: boolean;
  onScrollEnabledChange?: (enabled: boolean) => void;
  onAutoScroll?: (direction: 'up' | 'down' | null) => void;
  onLayout?: (layout: { y: number, height: number }) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AUTO_SCROLL_THRESHOLD = 100; // Distance from top/bottom to trigger auto-scroll
const SCROLL_SPEED = 15; // Pixels per frame for auto-scrolling

export const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  children,
  onDragStart,
  onDragEnd,
  onMove,
  isDragging,
  onScrollEnabledChange,
  onAutoScroll,
  onLayout,
}) => {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const [widgetHeight, setWidgetHeight] = React.useState(0);
  const [currentY, setCurrentY] = React.useState(0);
  const lastGestureDy = React.useRef(0);
  const lastTouchY = React.useRef(0);
  const isDraggingRef = React.useRef(false);
  const containerRef = React.useRef<View>(null);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start dragging if the movement is primarily vertical
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2;
      },
      onPanResponderGrant: (_, gestureState) => {
        isDraggingRef.current = true;
        lastTouchY.current = gestureState.y0;
        pan.setOffset({
          x: 0,
          y: currentY,
        });
        onDragStart();
        onScrollEnabledChange?.(false);
      },
      onPanResponderMove: (_, gesture) => {
        if (!isDraggingRef.current) return;

        lastGestureDy.current = gesture.dy;
        lastTouchY.current = gesture.moveY;
        
        // Calculate absolute position for auto-scroll detection
        const absoluteY = gesture.moveY;
        const isNearTop = absoluteY < AUTO_SCROLL_THRESHOLD;
        const isNearBottom = absoluteY > SCREEN_HEIGHT - AUTO_SCROLL_THRESHOLD;
        
        if (isNearTop) {
          onAutoScroll?.('up');
        } else if (isNearBottom) {
          onAutoScroll?.('down');
        } else {
          onAutoScroll?.(null);
        }

        // Update position with gesture
        pan.y.setValue(gesture.dy);
        onMove(gesture.dy);
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        pan.flattenOffset();
        const newY = currentY + lastGestureDy.current;
        setCurrentY(newY);
        onScrollEnabledChange?.(true);
        onAutoScroll?.(null);
        onDragEnd();
        
        // Animate back to original position
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 8,
          tension: 40,
        }).start();
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        pan.flattenOffset();
        const newY = currentY + lastGestureDy.current;
        setCurrentY(newY);
        onScrollEnabledChange?.(true);
        onAutoScroll?.(null);
        onDragEnd();
        
        // Animate back to original position
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 8,
          tension: 40,
        }).start();
      },
    })
  ).current;

  const handleLayout = (event: any) => {
    const { height, y } = event.nativeEvent.layout;
    setWidgetHeight(height);
    onLayout?.({ y, height });
  };

  const translateY = pan.y.interpolate({
    inputRange: [-SCREEN_HEIGHT, SCREEN_HEIGHT],
    outputRange: [-SCREEN_HEIGHT, SCREEN_HEIGHT],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      ref={containerRef}
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          zIndex: isDragging ? 1000 : 1,
          elevation: isDragging ? 5 : 1,
        },
      ]}
      onLayout={handleLayout}
    >
      <View style={styles.dragHandle} {...panResponder.panHandlers}>
        <Ionicons name="reorder-three" size={24} color="#7e5cff" />
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2d3a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dragHandle: {
    height: 40,
    backgroundColor: '#1a1c25',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3d4a',
  },
  content: {
    padding: 16,
  },
}); 