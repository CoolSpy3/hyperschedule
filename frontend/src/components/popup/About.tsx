import Css from "./About.module.css";
import { memo } from "react";

type Maintainer = {
    name: string;
    classYear: string;
    githubName: string;
};

// future maintainer: don't forget to also add your name to
// frontend/vite.config.ts
const currentMaintainers: Maintainer[] = [
];

const previousMaintainers: Maintainer[] = [
    {
        name: "Mia Celeste",
        classYear: "HM '24",
        githubName: "mia1024",
    },
    {
        name: "Kye Shi",
        classYear: "HM '22",
        githubName: "kwshi",
    },
    {
        name: "Radon Rosborough",
        classYear: "HM '20",
        githubName: "raxod502",
    },
];

const GitHubLink = memo(function (props: {
    name: string | null;
    username: string;
}) {
    return (
        <a href={`https://github.com/${props.username}`} target="_blank">
            {props.name ?? props.username}
            {/*<Feather.ExternalLink/>*/}
        </a>
    );
});

function createMaintainerRow(m: Maintainer) {
    return (
        <p>
            <GitHubLink name={m.name} username={m.githubName} />, {m.classYear}
        </p>
    );
}

export default memo(function About() {
    return (
        <div className={Css.about}>
            <h2>About</h2>

            <p>
                Hyperschedule is a student-run course scheduler for the
                Claremont Colleges.
            </p>
            <h3>
                Current Maintainer{currentMaintainers.length > 1 ? "s" : ""}
            </h3>
            {currentMaintainers.map(createMaintainerRow)}
            <h3>Previous Maintainers</h3>
            {previousMaintainers.map(createMaintainerRow)}

            <h3>Contributors</h3>
            <div className={Css.contributors}>
                {__CONTRIBUTOR_GH_NAMES__.map(({ name, username }) => (
                    <GitHubLink
                        key={username}
                        username={username}
                        name={name}
                    />
                ))}
            </div>
            <h3>License</h3>
            <p>
                Hyperschedule is licensed under{" "}
                <a href="https://spdx.org/licenses/BSD-3-Clause-No-Military-License.html">
                    BSD 3-Clause No Military License
                </a>
                . By using this program, you acknowledge that you are not
                voluntarily involved in the design, construction, operation,
                maintenance, or training of any military facility.
            </p>
        </div>
    );
});
