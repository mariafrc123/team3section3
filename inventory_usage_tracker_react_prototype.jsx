"use client";
// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Package, Trophy, Target } from "lucide-react";

// -------------------- Utils --------------------
const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => new Date().toISOString();
const toDateOnly = (d) => new Date(d).toISOString().slice(0, 10);
const fmtCurrency = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(n || 0));

// Default season: current year summer (Jun 1 -> Aug 31)
const y = new Date().getFullYear();
const DEFAULT_SEASON = { start: `${y}-06-01`, end: `${y}-08-31` };

// Brand color (Vivint dark)
const BRAND = "#282a3b"; // be sure this constant name doesn't conflict with imports

// Standardized loss reasons
const LOSS_REASONS = ["Stolen", "Damaged", "Misplaced", "Expired/Obsolete", "Installer Error", "Other"];

// -------------------- Local Storage --------------------
const LS_KEYS = {
  employees: "inv_employees_v2",
  txns: "inv_txns_v2",
  season: "inv_season_v2",
};
const lsGet = (k, f) => {
  try {
    if (typeof localStorage === "undefined") return f;
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : f;
  } catch {
    return f;
  }
};
const lsSet = (k, v) => {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// -------------------- Seed Data --------------------
// 10 installers: 5 Full-time, 5 Summer across regions
const seedEmployees = [
  { id: uuid(), name: "Jordan Kim", role: "Installer", empType: "Full-time", team: "Alpha", region: "East" },
  { id: uuid(), name: "Taylor Brooks", role: "Installer", empType: "Full-time", team: "Alpha", region: "West" },
  { id: uuid(), name: "Riley Gomez", role: "Installer", empType: "Full-time", team: "Alpha", region: "South" },
  { id: uuid(), name: "Casey Morgan", role: "Installer", empType: "Full-time", team: "Alpha", region: "North" },
  { id: uuid(), name: "Avery Chen", role: "Installer", empType: "Full-time", team: "Alpha", region: "West" },
  { id: uuid(), name: "Peyton Diaz", role: "Installer", empType: "Summer", team: "Bravo", region: "East" },
  { id: uuid(), name: "Quinn Patel", role: "Installer", empType: "Summer", team: "Bravo", region: "West" },
  { id: uuid(), name: "Drew Allen", role: "Installer", empType: "Summer", team: "Bravo", region: "South" },
  { id: uuid(), name: "Skylar Nguyen", role: "Installer", empType: "Summer", team: "Bravo", region: "North" },
  { id: uuid(), name: "Emerson Lee", role: "Installer", empType: "Summer", team: "Bravo", region: "East" },
];

// Transactions are optional for demo; we synthesize metrics instead of logging
const seedTxns = [];
const DEMO_MODE = true;

// -------------------- Main App --------------------
export default function InventoryUsageTracker() {
  const [employees, setEmployees] = useState(() => lsGet(LS_KEYS.employees, seedEmployees));
  const [txns, setTxns] = useState(() => lsGet(LS_KEYS.txns, seedTxns));
  const [season, setSeason] = useState(() => lsGet(LS_KEYS.season, DEFAULT_SEASON));

  useEffect(() => { lsSet(LS_KEYS.employees, employees); }, [employees]);
  useEffect(() => { lsSet(LS_KEYS.txns, txns); }, [txns]);
  useEffect(() => { lsSet(LS_KEYS.season, season); }, [season]);

  // Ensure 10 demo installers if storage has fewer
  useEffect(() => {
    if (DEMO_MODE && employees.length < 10) {
      setEmployees(seedEmployees);
    }
  }, [employees]);

  // -------------------- Leaderboard (Demo Synthesized) --------------------
  const installerLeaderboard = useMemo(() => {
    const installers = employees.filter(e => (e.role || "").toLowerCase() === "installer");

    if (DEMO_MODE) {
      const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const reasons = LOSS_REASONS.filter(r => r !== "Other");
      const perEmp = installers.map(emp => {
        const installs = randInt(35, 120);
        const losses = randInt(0, Math.max(0, Math.floor(installs * 0.2)));
        const avgUnitCost = randInt(40, 250);
        const lossValue = losses * avgUnitCost;
        const lossReason = reasons.length ? pick(reasons) : "Damaged";
        const score = randInt(1, 10); // normalized display score
        const progressPercent = randInt(35, 100);
        return { emp, installs, losses, lossValue, lossReason, score, progressPercent };
      }).sort((a, b) => b.score - a.score || b.installs - a.installs);

      const byRegion = new Map();
      perEmp.forEach(r => {
        const key = r.emp.region || "Unknown";
        if (!byRegion.has(key)) byRegion.set(key, { region: key, installs: 0, losses: 0, lossValue: 0, score: 0 });
        const agg = byRegion.get(key);
        agg.installs += r.installs; agg.losses += r.losses; agg.lossValue += r.lossValue; agg.score += r.score;
      });
      const regions = Array.from(byRegion.values()).sort((a, b) => b.score - a.score);
      return { perEmp, regions };
    }

    // Non-demo (derive from txns/season) – left here for future live mode
    const start = season.start; const end = season.end;
    const inRange = (ts, a, b) => {
      const x = new Date(ts).getTime();
      return x >= new Date(a).getTime() && x <= new Date(b).getTime();
    };

    const perEmp = installers.map(emp => {
      const rows = txns.filter(t => t.employeeId === emp.id && inRange(t.timestamp, start, end));
      const installs = rows.filter(t => t.type === "issue" && t.activity === "Install").reduce((s, t) => s + t.qty, 0);
      const lossRows = rows.filter(t => t.type === "loss");
      const losses = lossRows.reduce((s, t) => s + t.qty, 0);
      const lossValue = lossRows.reduce((s, t) => s + Number(t.lossValue || 0), 0);
      const lossReason = (() => {
        const m = new Map();
        lossRows.forEach(t => { const k = t.lossReason || "-"; m.set(k, (m.get(k) || 0) + t.qty); });
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      })();
      const score = Math.max(1, Math.min(10, installs - losses));
      const progressPercent = Math.min(100, Math.round((score / 10) * 100));
      return { emp, installs, losses, lossValue, lossReason, score, progressPercent };
    }).sort((a, b) => b.score - a.score || b.installs - a.installs);

    const byRegion = new Map();
    perEmp.forEach(r => {
      const key = r.emp.region || "Unknown";
      if (!byRegion.has(key)) byRegion.set(key, { region: key, installs: 0, losses: 0, lossValue: 0, score: 0 });
      const agg = byRegion.get(key);
      agg.installs += r.installs; agg.losses += r.losses; agg.lossValue += r.lossValue; agg.score += r.score;
    });
    const regions = Array.from(byRegion.values()).sort((a, b) => b.score - a.score);
    return { perEmp, regions };
  }, [employees, txns, season]);

  // -------------------- Actions --------------------
  function exportTxns() {
    const rows = txns.map(t => ({ ...t }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions_${toDateOnly(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  function exportEmployees() {
    const rows = employees.map(e => ({ id: e.id, name: e.name, type: e.empType, team: e.team, region: e.region }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `employees_${toDateOnly(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  function resetDemo() {
    setEmployees(seedEmployees);
    setTxns([]);
    toast.success("Demo data reset: 10 installers loaded");
  }

  // -------------------- Simple CSV --------------------
  function toCSV(rows) {
    const headers = Object.keys(rows[0] || {});
    if (!headers.length) return "";
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  }

  // -------------------- Dev Self-Tests (runtime) --------------------
  useEffect(() => {
    // Ensure we have exactly 10 installers and required fields
    console.assert(employees.length >= 10, "Expected at least 10 employees in demo mode");
    const sample = installerLeaderboard.perEmp[0];
    if (sample) {
      console.assert(typeof sample.installs === "number", "installs should be numeric");
      console.assert(typeof sample.losses === "number", "losses should be numeric");
      console.assert(typeof sample.lossValue === "number", "lossValue should be numeric");
      console.assert(typeof sample.score === "number" && sample.score >= 1 && sample.score <= 10, "score should be 1-10");
      console.assert(typeof sample.progressPercent === "number" && sample.progressPercent >= 0 && sample.progressPercent <= 100, "progressPercent should be 0-100");
      console.assert(typeof sample.lossReason === "string", "lossReason should be string");
    }
  }, [employees, installerLeaderboard]);

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 space-y-6">
      <header className="flex items-center justify-between" style={{ background: BRAND, color: "white", borderRadius: "16px", padding: "16px" }}>
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Inventory Usage & Incentives Tracker</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white text-white hover:bg-white hover:text-[#282a3b]" onClick={exportEmployees}><Download className="w-4 h-4 mr-2"/>Export Employees</Button>
          <Button variant="outline" className="border-white text-white hover:bg-white hover:text-[#282a3b]" onClick={exportTxns}><Download className="w-4 h-4 mr-2"/>Export Transactions</Button>
          <Button className="bg-white text-[#282a3b] hover:bg-gray-100" onClick={resetDemo}>Reset Demo Data</Button>
        </div>
      </header>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full border rounded-2xl">
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-[#282a3b] data-[state=active]:text-white">Leaderboard</TabsTrigger>
          <TabsTrigger value="incentives" className="data-[state=active]:bg-[#282a3b] data-[state=active]:text-white">Incentives</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Trophy className="w-5 h-5"/><h3 className="text-lg font-semibold">Installer Leaderboard (Season)</h3></div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Season</label>
                  <Input type="date" value={season.start} onChange={e=>setSeason(s=>({ ...s, start: e.target.value }))} />
                  <span>-</span>
                  <Input type="date" value={season.end} onChange={e=>setSeason(s=>({ ...s, end: e.target.value }))} />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Region</th>
                      <th className="p-3">Installs</th>
                      <th className="p-3">Losses</th>
                      <th className="p-3">Loss $</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Score</th>
                      <th className="p-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installerLeaderboard.perEmp.map(r => (
                      <tr key={r.emp.id} className="border-t">
                        <td className="p-3 font-medium">{r.emp.name} {r.emp.empType === 'Summer' && (<Badge>Summer</Badge>)}</td>
                        <td className="p-3">{r.emp.empType}</td>
                        <td className="p-3">{r.emp.region}</td>
                        <td className="p-3">{r.installs}</td>
                        <td className="p-3">{r.losses}</td>
                        <td className="p-3">{fmtCurrency(r.lossValue)}</td>
                        <td className="p-3">{r.lossReason || '-'}</td>
                        <td className="p-3 font-semibold">{r.score}</td>
                        <td className="p-3 w-48"><ProgressBar value={r.progressPercent} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">Top Regions</h4>
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left"><tr>
                      <th className="p-3">Region</th>
                      <th className="p-3">Installs</th>
                      <th className="p-3">Losses</th>
                      <th className="p-3">Loss $</th>
                      <th className="p-3">Score</th>
                    </tr></thead>
                    <tbody>
                      {installerLeaderboard.regions.map(r => (
                        <tr key={r.region} className="border-t">
                          <td className="p-3 font-medium">{r.region}</td>
                          <td className="p-3">{r.installs}</td>
                          <td className="p-3">{r.losses}</td>
                          <td className="p-3">{fmtCurrency(r.lossValue)}</td>
                          <td className="p-3 font-semibold">{r.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Incentives Tab */}
        <TabsContent value="incentives" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2"><Target className="w-5 h-5"/><h3 className="text-lg font-semibold">Programs & Installer Progress</h3></div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border p-4">
                  <h4 className="font-semibold mb-1">Installers – Summer Competition</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Competition for <b>top team/region</b> during the season window.</li>
                    <li>Prize: <b>$3,000</b> at end of summer or Mexico trip.</li>
                    <li>Company will <b>match amount to charity</b> of winner's choice.</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">We show a normalized <b>Score (1–10)</b> and <b>Progress %</b> toward incentive.</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <h4 className="font-semibold mb-1">Season Window</h4>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={season.start} onChange={e=>setSeason(s=>({ ...s, start: e.target.value }))} />
                    <span>-</span>
                    <Input type="date" value={season.end} onChange={e=>setSeason(s=>({ ...s, end: e.target.value }))} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Adjust dates to recalc non-demo leaderboard. In demo mode, values are randomized each render.</p>
                </div>
              </div>

              <h4 className="font-semibold">Installer Incentive Progress</h4>
              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Region</th>
                      <th className="p-3">Installs</th>
                      <th className="p-3">Losses</th>
                      <th className="p-3">Loss $</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Score (1–10)</th>
                      <th className="p-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installerLeaderboard.perEmp.map(r => (
                      <tr key={r.emp.id} className="border-t">
                        <td className="p-3 font-medium">{r.emp.name}</td>
                        <td className="p-3">{r.emp.empType}</td>
                        <td className="p-3">{r.emp.region}</td>
                        <td className="p-3">{r.installs}</td>
                        <td className="p-3">{r.losses}</td>
                        <td className="p-3">{fmtCurrency(r.lossValue)}</td>
                        <td className="p-3">{r.lossReason || '-'}</td>
                        <td className="p-3 font-semibold">{r.score}</td>
                        <td className="p-3 w-48"><ProgressBar value={r.progressPercent} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
      <div className="h-full" style={{ width: `${v}%`, background: BRAND }} />
    </div>
  );
}
