// Workshop availability block — public delivery intentionally excludes capacity and peer counts.
import React from "react";

export function RemainingSeatsBlock({ data, preview }: { data: any; preview?: boolean }) {
  if (preview) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <span className="font-medium">Workshop Availability</span>
        <p className="text-xs mt-1">Enrollment availability display</p>
      </div>
    );
  }
  return null;
}

export default RemainingSeatsBlock;
