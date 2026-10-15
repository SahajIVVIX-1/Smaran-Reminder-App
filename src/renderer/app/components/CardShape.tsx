import { CARD_LIMITS, CARD_RADIUS_DEFAULT, CARD_WIDTH, type Settings } from '@shared/schema';
import { Button, Row, Slider, Switch } from '../ui';

type Notification = Settings['notification'];

/**
 * Width, height and corner radius for every notification card, with a live preview at real size.
 * Defaults: the size preset's width, height that fits the content, and an 18 px radius.
 */
export function CardShape({
  n,
  onChange,
}: {
  n: Notification;
  onChange: (card: Notification['card']) => void;
}) {
  const { card } = n;
  const width = card.width ?? CARD_WIDTH[n.size];
  const isDefault =
    card.width === null && card.height === null && card.radius === CARD_RADIUS_DEFAULT;

  return (
    <>
      <Row label="Card width" hint={card.width === null ? 'From the size above.' : undefined}>
        <Slider
          label="Card width"
          value={width}
          min={CARD_LIMITS.width[0]}
          max={CARD_LIMITS.width[1]}
          step={4}
          suffix=" px"
          onChange={(w) => onChange({ ...card, width: w })}
        />
      </Row>
      <Row
        label="Card height"
        hint={card.height === null ? 'Fits the text.' : 'Longer text is cut off.'}
      >
        <Switch
          label="Custom card height"
          checked={card.height !== null}
          onChange={(on) => onChange({ ...card, height: on ? 132 : null })}
        />
        {card.height !== null && (
          <Slider
            label="Card height"
            value={card.height}
            min={CARD_LIMITS.height[0]}
            max={CARD_LIMITS.height[1]}
            step={2}
            suffix=" px"
            onChange={(h) => onChange({ ...card, height: h })}
          />
        )}
      </Row>
      <Row label="Corner roundness">
        <Slider
          label="Corner radius"
          value={card.radius}
          min={CARD_LIMITS.radius[0]}
          max={CARD_LIMITS.radius[1]}
          suffix=" px"
          onChange={(radius) => onChange({ ...card, radius })}
        />
      </Row>
      <div className="border-b border-line py-3 last:border-b-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px]">Preview</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={isDefault}
            onClick={() => onChange({ width: null, height: null, radius: CARD_RADIUS_DEFAULT })}
          >
            Reset to Default
          </Button>
        </div>
        <CardPreview width={width} height={card.height} radius={card.radius} />
      </div>
    </>
  );
}

/** A notification card at its real size (scaled down only if the page is narrower). */
function CardPreview({
  width,
  height,
  radius,
}: {
  width: number;
  height: number | null;
  radius: number;
}) {
  return (
    <div className="grid place-items-center overflow-hidden rounded-xl bg-raised px-3 py-5">
      <div
        className="relative flex max-w-full flex-col overflow-hidden transition-[width,height,border-radius] duration-200"
        style={{ width, height: height ?? undefined, borderRadius: radius }}
        aria-label="Notification preview"
      >
        <div className="glass-card absolute inset-0" style={{ borderRadius: 'inherit' }} />
        <div className="relative flex min-h-0 flex-1 gap-2.5 overflow-hidden px-3 pt-3 pb-2.5">
          <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-accent-soft" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex h-4 items-center gap-1.5 text-[11px] text-muted">
              <span className="font-serif text-[12.5px] italic">Smaran</span>
              <span className="ml-auto">now</span>
            </div>
            <div className="mt-1 line-clamp-2 font-serif text-[15.5px] leading-snug font-semibold text-ink">
              Stand up and stretch
            </div>
            <div className="mt-0.5 line-clamp-2 font-serif text-[13px] leading-snug text-muted">
              Roll your shoulders back and take three slow breaths.
            </div>
          </div>
        </div>
        <div className="relative flex shrink-0 gap-1.5 px-3 pb-3">
          <span className="grid h-[30px] flex-1 place-items-center rounded-[10px] bg-accent text-[12.5px] font-medium text-on-accent">
            Done
          </span>
          <span className="glass-button grid h-[30px] flex-1 place-items-center rounded-[10px] text-[12.5px] font-medium text-ink">
            Snooze
          </span>
        </div>
        <div className="ring-light ring-glow" aria-hidden />
        <div className="ring-light" aria-hidden />
      </div>
    </div>
  );
}
