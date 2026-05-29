# GitHub Pages

This repository is a static site. The Pages workflow publishes the repository root whenever `Develop` is pushed.

## Enable Pages

1. Open the repository on GitHub.
2. Go to `Settings` > `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `Develop`, or run `Deploy static site to GitHub Pages` from the `Actions` tab.

After the workflow succeeds, the site should be available at:

`https://immortalkilan.github.io/StudyAboardRestart/`

The `.nojekyll` file is intentional. It lets GitHub Pages serve asset folders whose names begin with `_`.
