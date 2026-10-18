// GET /api/elevators
// Proxies CTA's Customer Alerts API (accessibility alerts, plus any escalator alerts), normalizes it, and caches for 2 minutes.
export const SOURCE = 'https://www.transitchicago.com/api/1.0/alerts.aspx?outputType=JSON&accessibility=TRUE&activeonly=TRUE';
// Escalator outages may not be tagged as accessibility alerts (CTA had posted none at all, active or planned, in
// Oct 2026), so the full active feed is also checked for alerts whose headline or summary names an escalator.
const ALL = 'https://www.transitchicago.com/api/1.0/alerts.aspx?outputType=JSON&activeonly=TRUE';
const ESCALATOR = /escalator/i;

const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];

export async function elevators(env) {
  try {
    const [r, all] = await Promise.all([get(SOURCE), get(ALL).catch(() => null)]);
    if (!r.ok) throw new Error(`CTA returned ${r.status}`);
    const raw = arr((await r.json())?.CTAAlerts?.Alert);
    // The escalator check is best effort: without it, the accessibility alerts are still served.
    if (all?.ok) {
      const seen = new Set(raw.map(a => a.AlertId));
      const extra = arr((await all.json().catch(() => null))?.CTAAlerts?.Alert);
      raw.push(...extra.filter(a => !seen.has(a.AlertId) && ESCALATOR.test(`${a.Headline} ${a.ShortDescription}`)));
    }
    const alerts = raw.map(a => ({
      id: a.AlertId,
      headline: a.Headline || '',
      short: a.ShortDescription || '',
      stations: arr(a?.ImpactedService?.Service)
        .filter(s => s.ServiceType === 'T')
        .map(s => ({ id: s.ServiceId, name: s.ServiceName })),
      // Rail routes the alert names (CTA route IDs: Red, Blue, Brn, G, Org, P, Pexp, Pink, Y).
      routes: arr(a?.ImpactedService?.Service).filter(s => s.ServiceType === 'R').map(s => s.ServiceId),
    }));
    // The deployed version (Worker and static files deploy together), for the page's version note. tag = the commit
    // it was built from, set by scripts/deploy.sh.
    const v = env.CF_VERSION;
    return json({ updated: new Date().toISOString(), version: v ? { id: v.id, tag: v.tag || null, at: v.timestamp || null } : null, alerts }, 120);
  } catch (e) {
    return json({ error: String(e.message || e), alerts: [] }, 30, 502);
  }
}

const get = url => fetch(url, { cf: { cacheTtl: 120, cacheEverything: true } });

function json(body, maxAge, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
  });
}
