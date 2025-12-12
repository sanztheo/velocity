import { cn } from "@/lib/utils";

export function VelocityLogo({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg 
      viewBox="0 0 1024 1024" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      {...props}
    >
      <mask id="mask0_177_15" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="503" y="307" width="367" height="636">
        <rect width="423.039" height="423.039" transform="matrix(0.866025 -0.5 2.20305e-08 1 503.233 519.039)" fill="#EEEEEE"/>
      </mask>
      <g mask="url(#mask0_177_15)">
        <rect width="846.078" height="846.078" transform="matrix(-1.58247e-08 1 -0.866025 0.5 869.596 307.52)" fill="currentColor"/>
      </g>
      <mask id="mask1_177_15" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="136" y="307" width="368" height="636">
        <rect width="423.039" height="423.039" transform="matrix(0.866025 0.5 -2.20305e-08 1 136.874 307.52)" fill="#EEEEEE"/>
      </mask>
      <g mask="url(#mask1_177_15)">
        <rect width="846.078" height="846.078" transform="matrix(-5.98857e-08 1 -0.866025 -0.5 869.6 307.52)" fill="currentColor"/>
      </g>
      <mask id="mask2_177_15" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="136" y="96" width="734" height="424">
        <rect width="423.039" height="423.039" transform="matrix(0.866025 0.5 -0.866025 0.5 503.233 96)" fill="#EEEEEE"/>
      </mask>
      <g mask="url(#mask2_177_15)">
        <rect width="846.078" height="846.078" transform="matrix(-0.866025 0.5 -0.866025 -0.5 1235.96 519.039)" fill="currentColor"/>
      </g>
    </svg>
  );
}
