import express from 'express';

const EPA_ENTERO_THRESHOLD = 104;

function createAnomalyRoutes(appData) {
  const router = express.Router();

  router.get('/anomaly', (_req, res) => {
    const entero = appData.bacteria.filter((r) => r.parameter === 'ENTERO');
    if (entero.length === 0) {
      res.json({ alerts: [], checkedAt: new Date().toISOString().slice(0, 10) });
      return;
    }

    const dates = entero.map((r) => r.date).filter(Boolean).sort();
    const mostRecentDate = dates[dates.length - 1];
    const recentCutoff = subtractDays(mostRecentDate, 90);
    const baselineStart = '2018-01-01';
    const baselineEnd = '2022-12-31';

    const projects = ['PLOO', 'SBOO'];
    const alerts = [];

    for (const project of projects) {
      const projectData = entero.filter((r) => r.project === project);

      const recent = projectData.filter((r) => r.date >= recentCutoff);
      const baseline = projectData.filter(
        (r) => r.date >= baselineStart && r.date <= baselineEnd
      );

      if (recent.length === 0 || baseline.length === 0) continue;

      const recentAvg = avg(recent);
      const baselineAvg = avg(baseline);
      const pctChange = Math.round(((recentAvg - baselineAvg) / baselineAvg) * 100);

      const recentExceedanceRate = rate(recent);
      const baselineExceedanceRate = rate(baseline);

      let severity = 'normal';
      if (pctChange > 100) severity = 'critical';
      else if (pctChange > 25) severity = 'warning';
      else if (recentExceedanceRate > 0.15) severity = 'warning';

      if (severity !== 'normal') {
        alerts.push({
          project,
          recentAvg: Math.round(recentAvg * 10) / 10,
          baselineAvg: Math.round(baselineAvg * 10) / 10,
          pctChange,
          recentExceedanceRate: Math.round(recentExceedanceRate * 1000) / 1000,
          baselineExceedanceRate: Math.round(baselineExceedanceRate * 1000) / 1000,
          severity,
        });
      }
    }

    alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1));

    res.json({
      alerts,
      checkedAt: new Date().toISOString().slice(0, 10),
    });
  });

  return router;
}

function avg(records) {
  const sum = records.reduce((s, r) => s + r.value, 0);
  return sum / records.length;
}

function rate(records) {
  const exceed = records.filter((r) => r.value > EPA_ENTERO_THRESHOLD).length;
  return exceed / records.length;
}

function subtractDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export { createAnomalyRoutes };
