# Home Assistant add-on image for this fork (FORK.md). Built only by
# .github/workflows/image.yml, for linux/arm64, with the repository root as
# the build context. Every dependency comes from pnpm-lock.yaml.
#
# Base images are pinned to their linux/arm64 manifest digests; refresh them
# with the "Base image digests" workflow.
ARG NODE_IMAGE=node:22-alpine3.24@sha256:fd4a97c1630a4a0a70117dd7b393e322db316d0489bdf36a0e776e7b235341b0
ARG BASE_IMAGE=ghcr.io/hassio-addons/base:21.0.10@sha256:ab9b1a3bbe538fb4c477dcf61745afa94771d5c6c095c74a7ebbeaa2deb1f5e6

# Build: install from the lockfile, then build common, backend, frontend
# and the app (which copies the backend and frontend dist into its own).
FROM ${NODE_IMAGE} AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm at the version in package.json "packageManager", through corepack.
RUN corepack enable && pnpm --version
# The only step that downloads packages: everything the lockfile names,
# checked against its integrity hashes, into the store.
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline --ignore-scripts
RUN pnpm --filter './packages/*' --filter './apps/*' run build

# Production dependencies of the app alone, from the same lockfile and
# store, with no network and no install scripts. The workspace packages
# are dev dependencies of the app: their code is already in its dist.
FROM build AS prod
WORKDIR /prod
RUN cp /src/package.json /src/pnpm-lock.yaml /src/pnpm-workspace.yaml \
      /src/.npmrc ./ \
 && for p in apps/home-assistant-matter-hub packages/backend packages/common \
      packages/frontend docs; do \
      mkdir -p "$p" && cp "/src/$p/package.json" "$p/"; \
    done \
 && pnpm install --frozen-lockfile --offline --ignore-scripts --prod \
      --filter home-assistant-matter-hub

# Runtime: the Home Assistant add-on base (s6-overlay, bashio) plus the node
# binary only, so no npm, npx, corepack or pnpm.
FROM ${BASE_IMAGE}
RUN apk add --no-cache libstdc++ \
 && addgroup -S hamh \
 && adduser -S -D -H -h /var/empty -s /sbin/nologin -G hamh hamh
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=prod /prod/node_modules /app/node_modules
COPY --from=prod /prod/apps/home-assistant-matter-hub/node_modules \
  /app/apps/home-assistant-matter-hub/node_modules
COPY --from=build /src/apps/home-assistant-matter-hub/package.json \
  /app/apps/home-assistant-matter-hub/package.json
COPY --from=build /src/apps/home-assistant-matter-hub/dist \
  /app/apps/home-assistant-matter-hub/dist
COPY --chmod=0755 apps/home-assistant-matter-hub/addon.docker-entrypoint.sh \
  /docker-entrypoint.sh

ENV NODE_ENV=production
ARG PACKAGE_VERSION=unknown
ARG VCS_REF=unknown
LABEL \
  io.hass.version="${PACKAGE_VERSION}" \
  io.hass.type="addon" \
  io.hass.arch="aarch64" \
  org.opencontainers.image.title="Home Assistant Matter Hub (household fork)" \
  org.opencontainers.image.source="https://github.com/AirDoogle/home-assistant-matter-hub" \
  org.opencontainers.image.revision="${VCS_REF}" \
  org.opencontainers.image.version="${PACKAGE_VERSION}" \
  org.opencontainers.image.licenses="Apache-2.0"

CMD ["/docker-entrypoint.sh"]
