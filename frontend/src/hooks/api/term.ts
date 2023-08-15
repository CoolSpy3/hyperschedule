import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@lib/config";
import * as APIv4 from "hyperschedule-shared/api/v4";

export function useCurrentTermQuery() {
    return useQuery({
        queryKey: ["term/current"],
        queryFn: async () => {
            const resp = await fetch(`${apiUrl}/v4/term/current`);
            return APIv4.TermIdentifier.parse(await resp.json());
        },
    });
}