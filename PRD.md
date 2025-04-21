## Summary
AdVault is a Windows desktop DAM built on Electron, designed to help copywriters manage large “swipefile” collections (127 GB+) with fast, resilient, local‑first storage. The MVP focuses on four core capabilities—metadata tagging, local storage, custom sorting, and thumbnail/preview generation—backed by robust functional and non‑functional requirements. Subsequent sections define user personas, detailed features, UI screens, performance targets, packaging strategy, and acceptance criteria to guide development and ensure alignment across stakeholders.

---

## 1. Background & Goals
- **Problem Statement**: Copywriters accumulate massive ad libraries (videos, images, text) that are difficult to organize, search, and preview efficiently.  
- **Product Vision**: Deliver a lightweight, resilient DAM that lets users tag, browse, and sort assets instantly—while keeping all files accessible via the OS folder tree if the database fails.  
- **Business Goals**:  
  1. Reduce time-to-inspiration by 50 % through fast search and previews.  
  2. Ensure 99.9 % availability of assets even under database corruption.  
  3. Achieve <300 ms search latency on 100 K assets.  
- **Strategic Alignment**: Supports your consulting business by streamlining ad research workflows and integrates with existing file-based processes.

---

## 2. User Personas & Stories
### Persona: “Solo Copywriter”
- **Age & Role**: 28–45 yrs, freelance or in‑house copywriter.  
- **Tech Comfort**: Intermediate; comfortable with desktop apps but no DBA skills.  
- **Pain Points**: Wastes hours finding past ads; fears metadata loss if database breaks.  
- **Primary Motivations**: Speed of search, data resilience, minimal setup complexity.

### Key User Stories
1. **Browse & Preview**  
   - *As a copywriter*, I want to see thumbnails/previews of assets in a grid so I can identify inspiration at a glance.  
2. **Bulk Tagging**  
   - *As a copywriter*, I want to select multiple files and assign metadata (year, advertiser, niche, adspower) in one action to save time.  
3. **Custom Sorting & Filtering**  
   - *As a copywriter*, I want to filter by tags and sort by my “adspower” score so I can prioritize high‑impact ads.  
4. **Offline Resilience**  
   - *As a copywriter*, I want a mirrored folder hierarchy (`Year/Advertiser/Niche`) so I can navigate files in the OS even if the app’s DB is corrupt.

---

## 3. Scope & Features
### MVP (Must‑Have)
1. **Metadata & Tagging** (date created, year, advertiser, niche, custom fields)  
2. **Local‑First Storage** (all assets remain on hard drive)  
3. **Custom Sorting/Filtering** (by tags + adspower integer)  
4. **Thumbnail & Preview Engine** (auto‑generate thumbnails/previews for images, video, PDFs)
5. **Version Control & History** (Implemented as a field with pointer to master version)

### Nice‑to‑Have (Future)
- Rapid Full‑Text Search (FTS5)  
- Folder‑Mirror Resilience  
- Scalability & Dynamic Custom Fields  
- Automated Workflows  
- AI‑Assisted Auto‑Tagging  
- Multi‑Format Transcoding  
- Usage Analytics  
- Access Controls & Encryption  
- Rights & License Management  
- Governance & Audit Trails  
- Configurable Backup Scheduler
- Integration APIs  

---

## 4. Functional Specifications
### 4.1. Main Screens
#### 4.1.1. Library View
- **Components**:  
  - Thumbnail grid (lazy‑loaded small thumbnails)  
  - Filter sidebar (tag facets, adspower slider)  
  - Search bar (text + metadata fields)  
- **Interactions**:  
  - Multi‑select thumbnails for batch tagging  
  - Click opens preview pane with metadata form

#### 4.1.2. Preview & Tag Editor
- **Components**:  
  - Medium‑res preview (image/video/PDF)  
  - Metadata fields (editable form)  
  - “Save” button triggers DB update + folder‑mirror sync

#### 4.1.3. Settings & Export
- **Components**:  
  - Metadata schema manager (add/remove custom fields)  
  - Export controls (immediate or scheduled folder‑mirror rebuild)  
  - Performance metrics (files indexed, last import time)

### 4.2. Data Model
- **SQLite schema** with tables:  
  - `Assets(id, path, createdAt, fileType, adspower)`  
  - `Tags(id, name)`  
  - `AssetTags(assetId, tagId)`  
  - `CustomFields(id, name, type)`  
  - `AssetCustomValues(assetId, fieldId, value)`

### 4.3. Batch Operations
- Bulk tag assignment via shift‑click selection  
- Bulk metadata export/import (CSV)

---

## 5. Non‑Functional Requirements
- **Performance**:  
  - Initial import of 10 000 files in <60 s.  
  - Search & filter operations return results in <300 ms (SQLite FTS5 indices).  
- **Reliability & Resilience**:  
  - Database backups before each metadata write.  
  - Folder‑mirror rebuild recovers entire tree within 2 min for 100 K assets.  
- **Security**:  
  - Files remain on disk; no external network calls by default.  
  - Optionally encrypt DB at rest with AES‑256.  
- **Usability**:  
  - UI built with Material UI to leverage familiar patterns on Windows.  
  - Accessibility: Keyboard navigation, screen‑reader labels.

---

## 6. Distribution & Support
- **Packaging**:  
  - Use `electron-builder` to produce NSIS installer (`.exe`) with code signing for Windows.  
  - Configure `autoUpdater` (electron-updater) against GitHub Releases for seamless in‑app updates.  
- **Error Reporting & Logging**:  
  - Integrate Sentry to capture renderer/main exceptions and crash dumps.  
  - Local log files retained for 30 days, rotating at 5 MB per file.

---

## 7. Success Metrics & Acceptance Criteria
- **Import Throughput**: Ingest 10 000 files in ≤60 s (Given a folder of assets, when I click “Import,” then the app displays “Import Complete” within 60 s.)  
- **Search Latency**: 95 % of searches return in ≤300 ms (Given 100 K indexed assets, when I search by tag or adspower, then results display within 300 ms.)  
- **Thumbnail Generation**: 100 % of supported assets yield a thumbnail on import (Given supported file types, when imported, then each asset has an associated thumbnail.)  
- **Data Resilience**: After simulating DB corruption, the folder‑mirror tree still allows manual access to 100 % of assets (Given broken SQLite file, then I can browse all assets in the exported folder hierarchy.)  
- **Update Flow**: New versions auto‑update without user intervention (Given a new release on GitHub, when the app restarts, then it auto‑updates to the latest version.)
