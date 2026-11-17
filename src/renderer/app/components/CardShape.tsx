import { useState } from 'react';
import {
  CARD_LIMITS,
  CARD_PADDING_DEFAULT,
  CARD_RADIUS_DEFAULT,
  CARD_WIDTH,
  type Settings,
} from '@shared/schema';
import { Button, Row, Slider, Switch } from '../ui';

type Notification = Settings['notification'];

/**
 * Width (length), height, border roundness and inner spacing for the initial unhovered
 * notification, with auto options and a live interactive preview.
 */
export function CardShape({
  n,
  onChange,
}: {
  n: Notification;
  onChange: (card: Notification['card']) => void;
}) {
  const { card } = n;
  const presetWidth = CARD_WIDTH[n.size];
  const isDefault =
    card.width === null &&
    card.height === null &&
    (card.radius === null || card.radius === CARD_RADIUS_DEFAULT) &&
    (card.padding === null || card.padding === undefined);

  return (
    <>
      <Row
        label="Notification width"
        hint={card.width === null ? 'Auto · fits title content.' : 'Fixed width.'}
      >
        <Switch
          label="Custom notification width"
          checked={card.width !== null}
          onChange={(on) => onChange({ ...card, width: on ? presetWidth : null })}
        />
        {card.width !== null && (
          <Slider
            label="Notification width"
            value={card.width}
            min={CARD_LIMITS.width[0]}
            max={CARD_LIMITS.width[1]}
            step={4}
            suffix=" px"
            onChange={(w) => onChange({ ...card, width: w })}
          />
        )}
      </Row>

      <Row
        label="Notification height"
        hint={card.height === null ? 'Auto · fits text and padding.' : 'Fixed height.'}
      >
        <Switch
          label="Custom notification height"
          checked={card.height !== null}
          onChange={(on) => onChange({ ...card, height: on ? 38 : null })}
        />
        {card.height !== null && (
          <Slider
            label="Notification height"
            value={card.height}
            min={CARD_LIMITS.height[0]}
            max={CARD_LIMITS.height[1]}
            step={2}
            suffix=" px"
            onChange={(h) => onChange({ ...card, height: h })}
          />
        )}
      </Row>

      <Row
        label="Corner roundness"
        hint={card.radius === null ? 'Auto · capsule pill.' : 'Custom corner radius.'}
      >
        <Switch
          label="Custom corner roundness"
          checked={card.radius !== null}
          onChange={(on) => onChange({ ...card, radius: on ? CARD_RADIUS_DEFAULT : null })}
        />
        {card.radius !== null && (
          <Slider
            label="Corner radius"
            value={card.radius}
            min={CARD_LIMITS.radius[0]}
            max={CARD_LIMITS.radius[1]}
            step={1}
            suffix=" px"
            onChange={(radius) => onChange({ ...card, radius })}
          />
        )}
      </Row>

      <Row
        label="Inner space"
        hint={card.padding == null ? 'Auto · default spacing.' : 'Custom padding.'}
      >
        <Switch
          label="Custom inner space"
          checked={card.padding != null}
          onChange={(on) => onChange({ ...card, padding: on ? CARD_PADDING_DEFAULT : null })}
        />
        {card.padding != null && (
          <Slider
            label="Inner padding"
            value={card.padding}
            min={CARD_LIMITS.padding[0]}
            max={CARD_LIMITS.padding[1]}
            step={1}
            suffix=" px"
            onChange={(p) => onChange({ ...card, padding: p })}
          />
        )}
      </Row>

      <div className="border-b border-line py-3 last:border-b-0">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-[13px] font-medium">Preview</span>
            <span className="ml-2 text-[12px] text-muted">Hover to see it expand</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={isDefault}
            onClick={() =>
              onChange({ width: null, height: null, radius: null, padding: null })
            }
          >
            Reset to Default
          </Button>
        </div>
        <CardPreview
          customWidth={card.width}
          presetWidth={presetWidth}
          customHeight={card.height}
          customRadius={card.radius}
          customPadding={card.padding ?? null}
        />
      </div>
    </>
  );
}

/** Live interactive preview of the initial unhovered notification that expands on hover. */
function CardPreview({
  customWidth,
  presetWidth,
  customHeight,
  customRadius,
  customPadding,
}: {
  customWidth: number | null;
  presetWidth: number;
  customHeight: number | null;
  customRadius: number | null;
  customPadding: number | null;
}) {
  const [hovered, setHovered] = useState(false);

  const padX = customPadding ?? 18;
  const padY = customPadding != null ? Math.max(4, Math.round(customPadding * 0.6)) : 9;

  // Unhovered vs expanded dimensions
  const autoUnhoveredWidth = Math.min(presetWidth, 230);
  const unhoveredWidth = customWidth ?? autoUnhoveredWidth;
  const unhoveredHeight = customHeight ?? Math.max(36, padY * 2 + 18);
  const autoRadius = Math.round(unhoveredHeight / 2);
  const unhoveredRadius = customRadius !== null ? customRadius : autoRadius;

  const width = hovered ? Math.max(presetWidth, unhoveredWidth) : unhoveredWidth;
  const height = hovered ? 138 : unhoveredHeight;
  const radius = hovered
    ? customRadius !== null
      ? customRadius
      : CARD_RADIUS_DEFAULT
    : unhoveredRadius;

  return (
    <div className="grid place-items-center overflow-hidden rounded-xl bg-raised px-3 py-6">
      <div
        className="relative flex max-w-full flex-col overflow-hidden select-none transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)]"
        style={{
          width,
          height,
          borderRadius: radius,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Notification preview"
      >
        <div className="glass-card absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
          {/* Unhovered initial notification */}
          <div
            className={`absolute inset-0 flex items-center transition-opacity duration-200 ${
              customWidth ? 'justify-between' : 'justify-start'
            } ${hovered ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
            style={{ padding: `${padY}px ${padX}px` }}
          >
            <span className="truncate font-serif text-[15px] leading-tight font-semibold text-ink">
              Stand up and stretch
            </span>
          </div>

          {/* Hovered expanded card */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-3 transition-opacity duration-200 ${
              hovered ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div className="flex gap-2.5">
              <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-accent-soft" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex h-4 items-center gap-1.5 text-[11px] text-muted">
                  <span className="font-serif text-[12px] italic">Smaran</span>
                  <span className="ml-auto">now</span>
                </div>
                <div className="mt-0.5 truncate font-serif text-[14.5px] font-semibold text-ink">
                  Stand up and stretch
                </div>
                <div className="truncate font-serif text-[12px] text-muted">
                  Roll your shoulders back and take three slow breaths.
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 pt-2">
              <span className="grid h-[28px] flex-1 place-items-center rounded-[8px] bg-accent text-[12px] font-medium text-on-accent">
                Done
              </span>
              <span className="glass-button grid h-[28px] flex-1 place-items-center rounded-[8px] text-[12px] font-medium text-ink">
                Snooze
              </span>
            </div>
          </div>
        </div>
        <div className="ring-light ring-glow" aria-hidden />
        <div className="ring-light" aria-hidden />
      </div>
    </div>
  );
}
