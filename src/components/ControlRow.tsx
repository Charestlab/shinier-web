import React from "react";

export default function ControlRow({
  label,
  children,
  right,
  className,
  labelClassName,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={`control-row ${className || ""}`}>
      <div className={`control-label ${labelClassName || ""}`}>{label}</div>
      <div className="control-body">{children}</div>
      {right ? <div className="control-right">{right}</div> : null}
    </div>
  );
}
