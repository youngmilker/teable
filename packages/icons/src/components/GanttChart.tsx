import * as React from 'react';
import type { SVGProps } from 'react';
const GanttChart = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 3v18M3 7h8M3 12h14M3 17h10"
    />
  </svg>
);
export default GanttChart;
