# Building AI Applications for Livelihoods

**Lessons and tools from [Kabakoo Academies](https://www.kabakoo.africa/), drawn from its WhatsApp learning system.**

[Read the playbook](https://playbook.kabakoo.africa/) · [Explore Kabakoo’s work](https://www.kabakoo.africa/) · [Contact Kabakoo](mailto:akwaba@kabakoo.africa)

How can an AI-supported learning system help people develop their livelihoods? This playbook shares practical lessons from Kabakoo’s work: framing a useful problem, designing learning experiences, building AI mentors, supporting participation, and learning from experiments.

It is written for organizations building or adapting AI-supported learning tools. The web edition combines ten chapters, ten interactive working tools, learner stories, annotated interface examples, and editable explanatory drawings. Five further chapters are forthcoming. This repository contains the publication source and its browser-based reader tools.

## Start reading

| Chapter | Read online |
| --- | --- |
| 1. Problem framing | [Define the problem](https://playbook.kabakoo.africa/chapters/01-problem-framing.html) |
| 2. Theory of change | [Connect activities to outcomes](https://playbook.kabakoo.africa/chapters/02-theory-of-change.html) |
| 3. Readiness | [Understand the starting conditions](https://playbook.kabakoo.africa/chapters/03-readiness.html) |
| 4. Product design | [Design the learning experience](https://playbook.kabakoo.africa/chapters/04-product-design.html) |
| 5. Architecture | [Examine the system](https://playbook.kabakoo.africa/chapters/05-architecture.html) |
| 6. AI mentors | [Build and evaluate mentor support](https://playbook.kabakoo.africa/chapters/06-ai-mentors.html) |
| 7. Onboarding | [Support the first steps](https://playbook.kabakoo.africa/chapters/07-onboarding.html) |
| 8. Continuation | [Help learners return](https://playbook.kabakoo.africa/chapters/08-continuation.html) |
| 9. Peer learning | [Support useful exchange](https://playbook.kabakoo.africa/chapters/09-peer-learning.html) |
| 10. Experiments | [Learn from changes](https://playbook.kabakoo.africa/chapters/10-experiments.html) |

See the [working tools](https://playbook.kabakoo.africa/resources.html), [learner stories and interface examples](https://playbook.kabakoo.africa/field-notes.html), and [sources and limitations](https://playbook.kabakoo.africa/sources.html).

## About Kabakoo

[Kabakoo Academies](https://www.kabakoo.africa/) builds learning experiences and tools that support livelihoods. This playbook draws on the work of its learners, team, and collaborators. Visit [Kabakoo’s main website](https://www.kabakoo.africa/) to learn more about the organization and its work, and read the [collective acknowledgments](https://playbook.kabakoo.africa/versions.html).

## Build and preview

Install [Quarto 1.10.18](https://quarto.org/docs/get-started/) and Python 3.10 or newer. The fonts, images, chapter source, and reader scripts are included. CI uses Quarto 1.10.18; newer Quarto versions require verification because the build adapts its browser-storage behavior.

```sh
git clone https://github.com/Kabakoo/ai-for-livelihoods-playbook.git
cd ai-for-livelihoods-playbook
python3 scripts/build.py
python3 -m http.server 8774 --bind 127.0.0.1 --directory _site
```

Open <http://localhost:8774/>. Set `QUARTO_BIN` if Quarto is installed outside your `PATH`. The build renders HTML, prepares the standalone site, and checks all 16 pages. Run `python3 scripts/check.py` to repeat the static checks. [Browser verification](BROWSER-CHECKS.md) exercises navigation, working tools, and unavailable-storage behavior.

The editable chapters are in `chapters/`; the other `.qmd` files contain the opening, resources, sources, and edition information. Styling, scripts, and images are in `assets/`. `_render/` and `_site/` are generated and ignored by Git. CI validates changes without deploying a website.

## Adapt, translate, and contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for corrections, translations, and proposed changes. Keep source attribution and the distinction between observed results and proposed exercises. Review the [asset terms](ASSETS.md) before reusing photographs, screenshots, or brand assets.

This repository begins with **web edition 7, September 14, 2026**, tagged `2026.09-v7`. [CHANGELOG.md](CHANGELOG.md) records releases. The published reading address is **https://playbook.kabakoo.africa/**; GitHub provides the editable source and collaboration history.

## Credit and licensing

> Kabakoo Academies. (2026). *Building AI Applications for Livelihoods: Lessons and tools from Kabakoo’s WhatsApp learning system*. Web edition 7. https://playbook.kabakoo.africa/

When sharing or adapting the playbook, credit [Kabakoo Academies](https://www.kabakoo.africa/) and link to the [original playbook](https://playbook.kabakoo.africa/). A machine-readable citation is included in [CITATION.cff](CITATION.cff).

- Text, worksheets, and original explanatory drawings: [CC BY-SA 4.0](LICENSE-CONTENT.txt).
- Supporting code: [Apache-2.0](LICENSE).
- Photographs, learner likenesses, interface screenshots, and brand assets: separate terms in [ASSETS.md](ASSETS.md); the text license does not grant unrestricted reuse.
- Bundled fonts: SIL Open Font License notices in [licenses/](licenses/).

Third-party sources retain their own terms. Questions about adaptation, image reuse, or collaboration can be sent to [akwaba@kabakoo.africa](mailto:akwaba@kabakoo.africa).
