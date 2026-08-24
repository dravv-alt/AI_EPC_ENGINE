"use client";

import type { Route } from "next";
import Link from "next/link";
import { GlassCard, Pill, PrimaryButton } from "@/components/ui/glass";
import type { CopilotResponseEnvelope } from "@/lib/copilot/types";
import { rendererRegistry } from "./renderers";
import styles from "./copilot.module.css";

const AUTHORITY_LABEL: Record<CopilotResponseEnvelope["authority"], string> = {
  advisory: "Advisory",
  proposed_only: "Proposed only",
  recorded: "Recorded",
};

/** Renders one assistant turn — the full CopilotResponseEnvelope. */
export function CopilotMessage({ envelope, onOptionSelect }: { envelope: CopilotResponseEnvelope; onOptionSelect?: (option: string) => void }) {
  return (
    <GlassCard className={styles.messageCard}>
      <Pill variant="accent">{AUTHORITY_LABEL[envelope.authority]}</Pill>
      <p className={styles.summary}>{envelope.summary}</p>
      {envelope.detail && <p className={styles.detail}>{envelope.detail}</p>}

      {envelope.options && envelope.options.length > 0 && (
        <div className={styles.optionRow}>
          {envelope.options.map((option) => (
            <PrimaryButton key={option} type="button" className={styles.optionButton} onClick={() => onOptionSelect?.(option)}>
              {option}
            </PrimaryButton>
          ))}
        </div>
      )}

      {envelope.citations.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Citations</p>
          <ul className={styles.list}>
            {envelope.citations.map((citation) => (
              <li className={styles.citationItem} key={citation.sourceRegionId}>
                <strong>{citation.documentTitle} · {citation.revision} · p.{citation.pageNumber}</strong>
                <p className={styles.citationExcerpt}>&ldquo;{citation.excerpt}&rdquo;</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {envelope.actions.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Actions taken</p>
          <ul className={styles.list}>
            {envelope.actions.map((action) => (
              <li key={`${action.tool}-${action.entityId}`}>
                <Link className={styles.actionItem} href={action.href as Route}>
                  <span>{action.tool} · {action.entityType} {action.entityId}</span>
                  <Pill variant="neutral">{action.status}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {envelope.links.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Links</p>
          <ul className={styles.list}>
            {envelope.links.map((link) => (
              <li key={link.href}>
                <Link className={styles.linkItem} href={link.href as Route}>
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {envelope.renders.map((render, index) => (
        // render.key is the RENDERER TYPE (e.g. "gateReadinessTable"), not a
        // unique id — one turn can legitimately produce more than one render
        // of the same type from different tool calls (e.g. readiness.gates
        // and readiness.gate_detail both render "gateReadinessTable"), which
        // caused a real React "two children with the same key" warning
        // (found live, browser console) and put render identity at risk of
        // being reused across mismatched data on update. `renders` is a
        // static array computed once per message and never reordered, so an
        // index-qualified key is safe here.
        <CopilotRenderBlock key={`${render.key}-${index}`} render={render} />
      ))}
    </GlassCard>
  );
}

function CopilotRenderBlock({ render }: { render: CopilotResponseEnvelope["renders"][number] }) {
  const Renderer = rendererRegistry[render.key];
  if (Renderer) {
    return (
      <div className={styles.section}>
        <Renderer data={render.data} />
      </div>
    );
  }
  // Rule 7 (render, don't generate): no renderer registered yet for this key (Wave 2
  // territory). Dump the real structured data the tool returned — never fabricate
  // prose from it.
  return (
    <div className={styles.section}>
      <p className={styles.renderNote}>Unsupported render: {render.key}</p>
      <pre className={styles.renderFallback}>{JSON.stringify(render.data, null, 2)}</pre>
    </div>
  );
}
