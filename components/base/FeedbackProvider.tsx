import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { FeedbackCard, SwiperCardFeedback } from './SwiperCardFeedback';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface FeedbackRequest {
  cards: FeedbackCard[];
  resolve: (results: { id: string; answer: 'yes' | 'no' }[]) => void;
}

const FeedbackContext = createContext<{
  show: (cards: FeedbackCard[]) => Promise<{ id: string; answer: 'yes' | 'no' }[]>;
} | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<FeedbackRequest[]>([]);
  const [current, setCurrent] = useState<FeedbackRequest | null>(null);
  const currentResultsRef = useRef<{ id: string; answer: 'yes' | 'no' }[]>([]);

  // Add a new request to the queue
  const show = useCallback((cards: FeedbackCard[]) => {
    return new Promise<{ id: string; answer: 'yes' | 'no' }[]>((resolve) => {
      setQueue((prev) => [...prev, { cards, resolve }]);
    });
  }, []);

  // When queue changes and nothing is being shown, show the next
  useEffect(() => {
    if (!current && queue.length > 0) {
      currentResultsRef.current = []; // Reset results for the new request
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [queue, current]);

  const handleFeedback = useCallback((id: string, answer: 'yes' | 'no') => {
    const alreadyAnswered = currentResultsRef.current.some(r => r.id === id);
    if (!alreadyAnswered) {
        currentResultsRef.current.push({ id, answer });
    }
  }, []);

  const handleClose = useCallback(() => {
    if (current) {
      const finalResults = current.cards.map(card =>
        currentResultsRef.current.find(r => r.id === card.id) || { id: card.id, answer: 'no' as 'no' }
      );
      current.resolve(finalResults);
      setCurrent(null);
    }
  }, [current]);

  // Wire up the static show method
  useEffect(() => {
    SwiperCardFeedback.show = show;
    return () => {
      SwiperCardFeedback.show = () => Promise.reject('FeedbackProvider is not mounted');
    };
  }, [show]);

  return (
    <FeedbackContext.Provider value={{ show }}>
      {children}
      {current && (
        <GestureHandlerRootView style={{ flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <SwiperCardFeedback
            cards={current.cards}
            visible
            onFeedback={handleFeedback}
            onClose={handleClose}
          />
        </GestureHandlerRootView>
      )}
    </FeedbackContext.Provider>
  );
};

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within a FeedbackProvider');
  return ctx;
} 