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
    <div className={clsx("inline-flex rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-sm", className)}>
      {options.map(o=>(
        <button key={o.value}
          onClick={()=>onChange(o.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm transition",
            value===o.value
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
