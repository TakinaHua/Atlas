# Backend plan after frontend review

The active stack is Node.js + Express. The current server exposes GET /api/health only. Review the trip dashboard, day navigation, place editing, and map before implementing substantive backend functionality.

After UI approval, agree on persistence, authentication, trip/place API contracts, map provider, and routing requirements. Browser data should have an explicit migration path. Prior Python code and data remain preserved for reference, but are not required or executed by npm scripts.
