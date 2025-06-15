import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Modal, Dimensions } from 'react-native';
import { Swiper, SwiperCardRefType } from 'rn-swiper-list';
import { t } from '@/config/i18n';

const { width, height } = Dimensions.get('window');

/**
 * Card data for feedback.
 */
export interface FeedbackCard {
  id: string;
  question: string;
}

/**
 * Props for SwiperCardFeedback.
 */
interface SwiperCardFeedbackProps {
  cards: FeedbackCard[];
  onFeedback: (id: string, answer: 'yes' | 'no') => void;
  visible: boolean;
  onClose: () => void;
}

/**
 * SwiperCardFeedback component displays feedback cards using rn-swiper-list.
 * @example
 *   await SwiperCardFeedback.show([{ id: '1', question: 'Do you like this app?' }]);
 */
export const SwiperCardFeedback: React.FC<SwiperCardFeedbackProps> & {
  show: (cards: FeedbackCard[]) => Promise<{ id: string; answer: 'yes' | 'no' }[]>;
} = ({ cards, onFeedback, visible, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef<SwiperCardRefType>(null);
  const [hasAnswered, setHasAnswered] = useState<{ [id: string]: boolean }>({});

  const handleButtonPress = useCallback(
    (card: FeedbackCard, answer: 'yes' | 'no') => {
      if (hasAnswered[card.id]) return;
      setHasAnswered((prev) => ({ ...prev, [card.id]: true }));
      onFeedback(card.id, answer);
      // Advance the swiper
      if (swiperRef.current && typeof swiperRef.current.swipeRight === 'function') {
        swiperRef.current.swipeRight();
      }
    },
    [hasAnswered, onFeedback]
  );

  const renderCard = useCallback(
    (card: FeedbackCard, _index: number) => (
      <View style={styles.cardContainer}>
        <View style={styles.cardContent}>
          <StyledText style={styles.questionText}>{card.question}</StyledText>
          <View style={styles.buttonRow}>
            <StyledButton
              style={styles.button}
              onPress={() => handleButtonPress(card, 'no')}
              accessibilityLabel={t('common.no', { defaultValue: 'No' })}
              title={t('common.no', { defaultValue: 'No' })}
              variant="outline"
            />
            <StyledButton
              style={styles.button}
              onPress={() => handleButtonPress(card, 'yes')}
              accessibilityLabel={t('common.yes', { defaultValue: 'Yes' })}
              title={t('common.yes', { defaultValue: 'Yes' })}
              variant="primary"
            />
          </View>
        </View>
      </View>
    ),
    [handleButtonPress]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Swiper
          ref={swiperRef}
          data={cards}
          renderCard={renderCard}
          cardStyle={styles.swiperCard}
          onIndexChange={setCurrentIndex}
          disableTopSwipe
          disableLeftSwipe
          disableRightSwipe
          onSwipedAll={onClose}
        />
      </View>
    </Modal>
  );
};

// Static show method for imperative usage
SwiperCardFeedback.show = function (
  cards: FeedbackCard[]
): Promise<{ id: string; answer: 'yes' | 'no' }[]> {
  // Implementation will be provided in a portal/hook
  throw new Error('Not implemented: SwiperCardFeedback.show must be wired up via a portal/hook.');
};

// Import these from base/
import { StyledText } from './StyledText';
import { StyledButton } from './StyledButton';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  swiperCard: {
    width: width * 0.9,
    height: height * 0.4,
    borderRadius: 16,
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  questionText: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    minWidth: 80,
  },
}); 