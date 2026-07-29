// RemainingSeatsBlock - stub for TC (workshop/cohort seat availability is UA-specific)
import React from "react";

export function RemainingSeatsBlock({ data, preview }: { data: any; preview?: boolean }) {
  if (preview) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <span className="font-medium">Remaining Seats Block</span>
        <p className="text-xs mt-1">Seat availability display</p>
      </div>
    );
  }
  return null;
}

export default RemainingSeatsBlock;
