import React from "react";

export const CardSkeleton = () => (
  <div className="glass border border-slate-200 dark:border-slate-800 p-6 rounded-2xl animate-pulse space-y-4">
    <div className="flex justify-between items-center">
      <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="h-8 w-8 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
    </div>
    <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-1/2"></div>
    <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-3/4"></div>
  </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
  <div className="glass border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-pulse">
    <div className="h-12 bg-slate-200 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"></div>
    <div className="p-4 space-y-4">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex gap-4 items-center">
          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-12"></div>
          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded flex-1"></div>
          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-20"></div>
          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-24"></div>
          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-16"></div>
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="glass border border-slate-200 dark:border-slate-800 p-6 rounded-2xl animate-pulse flex flex-col h-80 justify-between">
    <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
    <div className="flex-1 flex gap-4 items-end justify-center px-4">
      <div className="h-2/3 bg-slate-300 dark:bg-slate-700 rounded w-10"></div>
      <div className="h-4/5 bg-slate-300 dark:bg-slate-700 rounded w-10"></div>
      <div className="h-1/2 bg-slate-300 dark:bg-slate-700 rounded w-10"></div>
      <div className="h-3/4 bg-slate-300 dark:bg-slate-700 rounded w-10"></div>
      <div className="h-3/5 bg-slate-300 dark:bg-slate-700 rounded w-10"></div>
    </div>
    <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-3/4 mt-4"></div>
  </div>
);
