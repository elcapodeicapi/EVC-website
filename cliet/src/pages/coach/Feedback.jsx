import React from "react";
import { feedbackItems } from "../../data/mockData";

const Feedback = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Feedback queue</h2>
        <p className="text-sm text-slate-500">Keep track of open reviews and recently submitted guidance.</p>
      </div>
      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        <ul className="divide-y divide-slate-100">
          {feedbackItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-6 py-4 text-sm">
              <div>
                <p className="font-medium text-slate-800">{item.customer}</p>
                <p className="text-xs text-slate-500">{item.competency}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                <p className="font-medium text-slate-700">{item.summary}</p>
              </div>
              <span className="text-xs text-slate-400">{item.updatedAt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Feedback;
