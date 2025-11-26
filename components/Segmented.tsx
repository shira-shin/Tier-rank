"use client";
import clsx from "clsx";

export default function Segmented<T extends string>({
  value, onChange, options, className
}:{
  value: T;
  onChange: (v:T)=>void;
  options: {label:string; value:T}[];
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border-2 border-slate-200 bg-slate-50 p-1 shadow-md dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      {options.map(o=>(
        <button key={o.value}
          onClick={()=>onChange(o.value)}
          className={clsx(
            "relative rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-1",
            value===o.value
              ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-100/50 dark:shadow-none"
              : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          )}
        >
          {value===o.value && (
            <span className="absolute inset-x-2 -top-1 block h-1 rounded-full bg-white/40" aria-hidden />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
