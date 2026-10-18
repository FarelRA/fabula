import { InfoIcon } from "lucide-react";

/**
 * Guest/demo banner. Anonymous sessions only for now; account claiming
 * arrives with sharing. The banner is honest
 * about where scenes live and never gates the first scene.
 */
export function ClaimBanner({ demo }: { demo: boolean }) {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
    >
      <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
      {demo ? (
        <span>
          Demo build, cast generation and playback data are simulated locally;
          nothing leaves this browser.
        </span>
      ) : (
        <span>
          Guest session, your scenes live in this browser. Account saving
          arrives with sharing.
        </span>
      )}
    </div>
  );
}
