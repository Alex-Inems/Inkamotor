"use client";

import { StatusPill, VpsShell } from "@/components/vps/shell";
import { activity } from "@/lib/vps/data";

export default function VpsActivityPage() {
  return (
    <VpsShell title="Activity" crumbs="production / audit">
      <div className="hx-card">
        <div className="hx-table-wrap">
          <table className="hx-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Action</th>
                <th>Target</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((ev) => (
                <tr key={ev.id}>
                  <td className="hx-mono" style={{ whiteSpace: "nowrap" }}>
                    {ev.at.replace("T", " ").replace("Z", "")}
                  </td>
                  <td>
                    <StatusPill status={ev.status} />
                  </td>
                  <td>{ev.action}</td>
                  <td className="hx-mono">{ev.target}</td>
                  <td className="hx-mono">{ev.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </VpsShell>
  );
}
