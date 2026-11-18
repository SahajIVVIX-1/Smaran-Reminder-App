import { useState } from 'react';
import type { MotionType, NotificationMotion } from '@shared/schema';
import { NumberField, Row, Segmented, Slider, Switch } from '../ui';
import { Select } from './Select';

const MOTION_DESCRIPTIONS: Record<MotionType, string> = {
  'fade-cycle': 'Fades in and out rhythmically during the reminder to catch your eye.',
  bounce: 'Springs into view with a lively bounce and attention hops.',
  pulse: 'Continuously pulses in size and accent glow.',
  wiggle: 'Shakes periodically like a bell to draw your attention.',
  slide: 'Calm, smooth entrance sliding in from the screen edge.',
};

const FADE_VISIBLE_PRESETS = [2, 3, 4, 5, 8, 10];
const FADE_SPEED_PRESETS = [0.4, 0.6, 1.0];

/**
 * Configure attention-grabbing motion styles for notifications:
 * Fade Cycle, Bounce, Breathing Pulse, Attention Shake, or Classic Slide,
 * each with its own tailored settings.
 */
export function NotificationMotionSettings({
  motion,
  onChange,
}: {
  motion: NotificationMotion;
  onChange: (patch: NotificationMotion) => void;
}) {
  const [customVisible, setCustomVisible] = useState(
    () => !FADE_VISIBLE_PRESETS.includes(motion.fadeCycle.visibleSec),
  );
  const [customFadeSpeed, setCustomFadeSpeed] = useState(
    () => !FADE_SPEED_PRESETS.includes(motion.fadeCycle.fadeSec),
  );

  const setType = (type: MotionType) => onChange({ ...motion, type });

  const setFadeCycle = (patch: Partial<NotificationMotion['fadeCycle']>) =>
    onChange({ ...motion, fadeCycle: { ...motion.fadeCycle, ...patch } });

  const setBounce = (patch: Partial<NotificationMotion['bounce']>) =>
    onChange({ ...motion, bounce: { ...motion.bounce, ...patch } });

  const setPulse = (patch: Partial<NotificationMotion['pulse']>) =>
    onChange({ ...motion, pulse: { ...motion.pulse, ...patch } });

  const setWiggle = (patch: Partial<NotificationMotion['wiggle']>) =>
    onChange({ ...motion, wiggle: { ...motion.wiggle, ...patch } });

  const setSlide = (patch: Partial<NotificationMotion['slide']>) =>
    onChange({ ...motion, slide: { ...motion.slide, ...patch } });

  return (
    <>
      <Row
        label="Attention motion"
        hint={MOTION_DESCRIPTIONS[motion.type]}
        htmlFor="set-motion-type"
      >
        <Select<MotionType>
          id="set-motion-type"
          className="w-52"
          value={motion.type}
          options={[
            { value: 'fade-cycle', label: 'Fade Cycle' },
            { value: 'bounce', label: 'Bounce / Spring' },
            { value: 'pulse', label: 'Breathing Pulse' },
            { value: 'wiggle', label: 'Attention Shake' },
            { value: 'slide', label: 'Classic Slide' },
          ]}
          onChange={(type: MotionType) => setType(type)}
        />
      </Row>

      {/* Motion-specific options based on the chosen motion type */}
      {motion.type === 'fade-cycle' && (
        <>
          <Row
            label="Stay visible for"
            hint="How long the card stays shown before fading out."
            htmlFor="set-fade-visible"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Select<number>
                id="set-fade-visible"
                className="w-36"
                value={
                  customVisible || !FADE_VISIBLE_PRESETS.includes(motion.fadeCycle.visibleSec)
                    ? -1
                    : motion.fadeCycle.visibleSec
                }
                options={[
                  { value: 2, label: '2 seconds' },
                  { value: 3, label: '3 seconds' },
                  { value: 4, label: '4 seconds' },
                  { value: 5, label: '5 seconds' },
                  { value: 8, label: '8 seconds' },
                  { value: 10, label: '10 seconds' },
                  { value: -1, label: 'Custom…' },
                ]}
                onChange={(val: number) => {
                  if (val === -1) {
                    setCustomVisible(true);
                  } else {
                    setCustomVisible(false);
                    setFadeCycle({ visibleSec: val });
                  }
                }}
              />
              {(customVisible || !FADE_VISIBLE_PRESETS.includes(motion.fadeCycle.visibleSec)) && (
                <NumberField
                  label="Visible duration"
                  value={motion.fadeCycle.visibleSec}
                  min={1}
                  max={60}
                  suffix="seconds"
                  onChange={(visibleSec: number) => setFadeCycle({ visibleSec })}
                />
              )}
            </div>
          </Row>
          <Row label="Fade transition" hint="How fast the card fades in and out.">
            <div className="flex flex-col gap-2">
              <Segmented<string>
                label="Fade transition speed"
                value={
                  customFadeSpeed || !FADE_SPEED_PRESETS.includes(motion.fadeCycle.fadeSec)
                    ? 'custom'
                    : String(motion.fadeCycle.fadeSec)
                }
                onChange={(val) => {
                  if (val === 'custom') {
                    setCustomFadeSpeed(true);
                  } else {
                    setCustomFadeSpeed(false);
                    setFadeCycle({ fadeSec: Number(val) });
                  }
                }}
                options={[
                  { value: '0.4', label: 'Fast (0.4s)' },
                  { value: '0.6', label: 'Smooth (0.6s)' },
                  { value: '1', label: 'Gentle (1.0s)' },
                  { value: 'custom', label: 'Custom…' },
                ]}
              />
              {(customFadeSpeed || !FADE_SPEED_PRESETS.includes(motion.fadeCycle.fadeSec)) && (
                <Slider
                  label="Fade transition duration"
                  value={motion.fadeCycle.fadeSec}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  suffix="s"
                  onChange={(val) => setFadeCycle({ fadeSec: Number(val.toFixed(1)) })}
                />
              )}
            </div>
          </Row>
          <Row label="Fade to" hint="Dim level while faded between cycles.">
            <Segmented<string>
              label="Fade depth"
              value={String(motion.fadeCycle.minOpacity)}
              onChange={(val) => setFadeCycle({ minOpacity: Number(val) })}
              options={[
                { value: '0', label: 'Vanish (0%)' },
                { value: '0.1', label: 'Ghost (10%)' },
                { value: '0.25', label: 'Dim (25%)' },
                { value: '0.4', label: 'Subtle (40%)' },
              ]}
            />
          </Row>
        </>
      )}

      {motion.type === 'bounce' && (
        <>
          <Row label="Bounce energy" hint="Springiness and overshoot upon arrival.">
            <Segmented<NotificationMotion['bounce']['energy']>
              label="Bounce energy"
              value={motion.bounce.energy}
              onChange={(energy) => setBounce({ energy })}
              options={[
                { value: 'gentle', label: 'Gentle' },
                { value: 'medium', label: 'Medium' },
                { value: 'energetic', label: 'Energetic' },
              ]}
            />
          </Row>
          <Row
            label="Repeat attention bounce"
            hint="Repeat a playful hop every 3.5 seconds if ignored."
            htmlFor="set-bounce-repeat"
          >
            <Switch
              id="set-bounce-repeat"
              label="Repeat bounce"
              checked={motion.bounce.repeat}
              onChange={(repeat) => setBounce({ repeat })}
            />
          </Row>
        </>
      )}

      {motion.type === 'pulse' && (
        <>
          <Row label="Pulse speed" hint="Rhythm of the breathing scale animation.">
            <Segmented<NotificationMotion['pulse']['speed']>
              label="Pulse speed"
              value={motion.pulse.speed}
              onChange={(speed) => setPulse({ speed })}
              options={[
                { value: 'calm', label: 'Calm' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'rapid', label: 'Rapid' },
              ]}
            />
          </Row>
          <Row
            label="Accent glow"
            hint="Pulse a soft warm accent glow around the card."
            htmlFor="set-pulse-glow"
          >
            <Switch
              id="set-pulse-glow"
              label="Accent glow"
              checked={motion.pulse.glow}
              onChange={(glow) => setPulse({ glow })}
            />
          </Row>
        </>
      )}

      {motion.type === 'wiggle' && (
        <>
          <Row
            label="Shake every"
            hint="Interval between attention-getting shakes."
            htmlFor="set-wiggle-interval"
          >
            <Select<number>
              id="set-wiggle-interval"
              className="w-36"
              value={motion.wiggle.intervalSec}
              options={[
                { value: 2, label: '2 seconds' },
                { value: 3, label: '3 seconds' },
                { value: 5, label: '5 seconds' },
                { value: 8, label: '8 seconds' },
              ]}
              onChange={(intervalSec: number) => setWiggle({ intervalSec })}
            />
          </Row>
          <Row label="Shake strength" hint="How vigorously the card shakes.">
            <Segmented<NotificationMotion['wiggle']['strength']>
              label="Shake strength"
              value={motion.wiggle.strength}
              onChange={(strength) => setWiggle({ strength })}
              options={[
                { value: 'subtle', label: 'Subtle' },
                { value: 'pronounced', label: 'Pronounced' },
              ]}
            />
          </Row>
        </>
      )}

      {motion.type === 'slide' && (
        <Row label="Slide speed" hint="Speed of the entrance slide from the edge.">
          <Segmented<NotificationMotion['slide']['speed']>
            label="Slide speed"
            value={motion.slide.speed}
            onChange={(speed) => setSlide({ speed })}
            options={[
              { value: 'snappy', label: 'Snappy' },
              { value: 'normal', label: 'Normal' },
              { value: 'smooth', label: 'Smooth' },
            ]}
          />
        </Row>
      )}
    </>
  );
}
