import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SHARING_ALERT_RECIPIENT,
  buildAccountSharingAlertEmail,
} from "./jobs/sharingMonitor";

describe("Course360 account-sharing monitor defaults", () => {
  it("uses the Course360 support recipient and platform footer", () => {
    expect(ACCOUNT_SHARING_ALERT_RECIPIENT).toEqual({
      name: "Course360 Support",
      email: "support@course360.app",
    });

    const html = buildAccountSharingAlertEmail([{
      userId: 17,
      userName: "Learner",
      email: "learner@example.test",
      distinctIps24h: 3,
      distinctIps7d: 5,
      ipList: [],
      reason: "5 distinct IPs in the last 7 days",
    }]);

    expect(html).toContain("Course360™ Account Sharing Monitor");
    expect(html).not.toContain("Teachific");
  });
});
