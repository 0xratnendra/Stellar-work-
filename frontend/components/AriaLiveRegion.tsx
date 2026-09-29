"use client";



type AriaLiveRegionProps = {
 
  message: string;
  
  politeness?: "polite" | "assertive";
  
  role?: "status" | "alert" | "log";
  
  atomic?: boolean;
  
  visible?: boolean;
  className?: string;
};

export default function AriaLiveRegion({
  message,
  politeness = "polite",
  role = politeness === "assertive" ? "alert" : "status",
  atomic,
  visible = false,
  className,
}: AriaLiveRegionProps) {
 
  const resolvedAtomic = atomic ?? role !== "log";

  return (
    <p
      role={role}
      aria-live={politeness}
      aria-atomic={resolvedAtomic}
      className={visible ? className : `sr-only${className ? ` ${className}` : ""}`}
    >
      {message}
    </p>
  );
}
