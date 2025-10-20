import React from "react";
import clsx from "clsx";

const DataTable = ({ columns = [], data = [], renderActions, emptyMessage = "Geen gegevens beschikbaar", dense }) => {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className={clsx("min-w-full divide-y divide-slate-200", dense ? "text-sm" : "text-base")}> 
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.accessor || column.id}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {column.header}
                </th>
              ))}
              {renderActions ? <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acties</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="px-4 py-8 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={row.id || rowIndex} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td key={column.accessor || column.id} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {column.render ? column.render(row) : row[column.accessor]}
                    </td>
                  ))}
                  {renderActions ? (
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {renderActions(row)}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
