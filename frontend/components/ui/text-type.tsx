'use client';

import { type ElementType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface TextTypeProps {
  className?: string;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: string | ReactNode;
  cursorBlinkDuration?: number;
  cursorClassName?: string;
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  textColors?: string[];
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
  reserveSpace?: boolean;
}

const TextType = ({
  text,
  as: Component = 'div',
  typingSpeed = 60,
  initialDelay = 0,
  pauseDuration = 1800,
  deletingSpeed = 35,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.6,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  reserveSpace = false,
  ...props
}: TextTypeProps & React.HTMLAttributes<HTMLElement>) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const blinkTweenRef = useRef<gsap.core.Tween | null>(null);

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const reserveText = useMemo(() => {
    if (!reserveSpace) return '';
    const longest = textArray.reduce((acc, item) => (item.length > acc.length ? item : acc), textArray[0] ?? '');
    return reverseMode ? longest.split('').reverse().join('') : longest;
  }, [reserveSpace, reverseMode, textArray]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return;
    return textColors[currentTextIndex % textColors.length];
  };

  useEffect(() => {
    setDisplayedText('');
    setCurrentCharIndex(0);
    setIsDeleting(false);
    setCurrentTextIndex(0);
  }, [textArray, reverseMode]);

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!showCursor || !cursorRef.current) return;
    blinkTweenRef.current?.kill();
    gsap.set(cursorRef.current, { opacity: 1 });
    blinkTweenRef.current = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut',
    });

    return () => {
      blinkTweenRef.current?.kill();
    };
  }, [showCursor, cursorBlinkDuration]);

  useEffect(() => {
    if (!isVisible) return;

    let timeout: ReturnType<typeof setTimeout>;

    const currentText = textArray[currentTextIndex] ?? '';
    const processedText = reverseMode ? currentText.split('').reverse().join('') : currentText;

    const schedule = (fn: () => void, delay: number) => {
      timeout = setTimeout(fn, delay);
    };

    if (isDeleting) {
      if (displayedText.length === 0) {
        if (currentTextIndex === textArray.length - 1 && !loop) return;
        schedule(() => {
          if (onSentenceComplete) onSentenceComplete(textArray[currentTextIndex] ?? '', currentTextIndex);
          setIsDeleting(false);
          setCurrentTextIndex(prev => (prev + 1) % textArray.length);
          setCurrentCharIndex(0);
        }, pauseDuration);
      } else {
        schedule(() => {
          setDisplayedText(prev => prev.slice(0, -1));
          setCurrentCharIndex(prev => Math.max(0, prev - 1));
        }, deletingSpeed);
      }
    } else {
      if (currentCharIndex < processedText.length) {
        schedule(() => {
          setDisplayedText(prev => prev + processedText[currentCharIndex]);
          setCurrentCharIndex(prev => prev + 1);
        }, currentCharIndex === 0 && displayedText === '' ? initialDelay : (variableSpeed ? getRandomSpeed() : typingSpeed));
      } else if (textArray.length >= 1) {
        if (!loop && currentTextIndex === textArray.length - 1) return;
        schedule(() => setIsDeleting(true), pauseDuration);
      }
    }

    return () => clearTimeout(timeout);
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    initialDelay,
    textArray,
    currentTextIndex,
    loop,
    isVisible,
    reverseMode,
    variableSpeed,
    getRandomSpeed,
    onSentenceComplete,
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping && (currentCharIndex < (textArray[currentTextIndex]?.length ?? 0) || isDeleting);

  return (
    <Component
      ref={containerRef}
      className={`inline-block whitespace-pre-wrap tracking-tight ${reserveSpace ? 'relative' : ''} ${className}`}
      {...props}
    >
      {reserveSpace && (
        <span
          aria-hidden="true"
          className="block whitespace-pre-line text-transparent select-none pointer-events-none"
        >
          {reserveText}
        </span>
      )}
      <span
        className={`${reserveSpace ? 'absolute inset-0 block whitespace-pre-line' : 'inline'}`}
        style={{ color: getCurrentTextColor() || 'inherit' }}
      >
        {displayedText}
        {showCursor && (
          <span
            ref={cursorRef}
            className={`ml-1 inline-block opacity-100 ${shouldHideCursor ? 'hidden' : ''} ${cursorClassName}`}
          >
            {cursorCharacter}
          </span>
        )}
      </span>
    </Component>
  );
};

export default TextType;
