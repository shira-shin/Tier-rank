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
    <div className={clsx("inline-flex rounded-xl border border-slate-300 bg-white p-1", className)}>
      {options.map(o=>(
        <button key={o.value}
          onClick={()=>onChange(o.value)}
          className={clsx(
            "px-3 py-1.5 text-sm rounded-lg",
            value===o.value ? "bg-slate-900 text-white" : "hover:bg-slate-100"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
