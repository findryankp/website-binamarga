// Dashboard Controller for Budget Analysis
document.addEventListener("DOMContentLoaded", function () {
    // Configure Chart.js global defaults
    if (window.Chart) {
        Chart.defaults.font.family = "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
    }

    // 1. Initialize State
    let state = {
        activeFilters: {
            tahun: '2026',
            jenisAnggaran: 'all',
            bidangUpt: 'all',
            program: 'all',
            search: ''
        },
        sorting: {
            column: 'no',
            direction: 'asc'
        },
        pagination: {
            currentPage: 1,
            limit: 10
        },
        mappingPagination: {
            currentPage: 1,
            limit: 20
        },
        mappingSearch: '',
        filteredData: [...BUDGET_DATA],
        charts: {}
    };

    // Update total database connection badge dynamically
    const elStatusIndicator = document.getElementById('status-indicator');
    if (elStatusIndicator) {
        elStatusIndicator.innerHTML = `<i class="bi bi-database-check me-1 text-success"></i> ${BUDGET_DATA.length.toLocaleString('id-ID')} Kegiatan Terkoneksi`;
    }

    // Formatter for Currency (Rupiah)
    const formatRupiah = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // Formatter for short Currency (e.g. Rp 1,27 T, Rp 68,45 M)
    const formatShortRupiah = (value) => {
        if (!value || value === 0) return 'Rp 0';
        if (value >= 1e12) {
            return 'Rp ' + (value / 1e12).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' T';
        } else if (value >= 1e9) {
            return 'Rp ' + (value / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M';
        } else if (value >= 1e6) {
            return 'Rp ' + (value / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Jt';
        }
        return 'Rp ' + value.toLocaleString('id-ID');
    };

    // 2. DOM Elements
    const elTahunFilter = document.getElementById('filter-tahun');
    const elJenisFilter = document.getElementById('filter-jenis');
    const elBidangFilter = document.getElementById('filter-bidang');
    const elProgramFilter = document.getElementById('filter-program');
    const elSearchInput = document.getElementById('search-input');
    const elBtnReset = document.getElementById('btn-reset');
    const elBtnExport = document.getElementById('btn-export');
    
    const elTotalApbd = document.getElementById('kpi-total-apbd');
    const elTotalPapbd = document.getElementById('kpi-total-papbd');
    const elApbdYoY = document.getElementById('kpi-apbd-yoy');
    const elPapbdYoY = document.getElementById('kpi-papbd-yoy');
    const elTotalProgram = document.getElementById('kpi-total-program');
    const elTotalKegiatan = document.getElementById('kpi-total-kegiatan');
    const elTotalSubkegiatan = document.getElementById('kpi-total-subkegiatan');
    
    // Mapping Tab DOM Elements
    const elMappingSearch = document.getElementById('mapping-search');
    const elMappingLimit = document.getElementById('mapping-limit');
    const elMappingTableBody = document.getElementById('mapping-table-body');
    const elMappingPaginationContainer = document.getElementById('mapping-pagination-container');
    const elMappingSummary = document.getElementById('mapping-summary');
    
    const elTableBody = document.getElementById('table-body');
    const elPaginationContainer = document.getElementById('pagination-container');
    const elTableSummary = document.getElementById('table-summary');
    const elTableLimit = document.getElementById('table-limit');
    
    const elInsightConcentration = document.getElementById('insight-concentration');
    const elInsightYoY = document.getElementById('insight-yoy');
    const elInsightEfficiency = document.getElementById('insight-efficiency');

    // 3. Initialize Filters Option Lists
    function updateYearFilterOptions(isKinerja) {
        if (!elTahunFilter) return;
        const currentYear = elTahunFilter.value || (state.activeFilters && state.activeFilters.tahun) || 'all';
        elTahunFilter.innerHTML = '';

        const defaultOpt = document.createElement('option');
        defaultOpt.value = 'all';
        defaultOpt.textContent = 'Semua Tahun';
        elTahunFilter.appendChild(defaultOpt);

        if (isKinerja) {
            const kinerjaYears = [
                '2019', '2020', '2021', '2022', '2023', '2024',
                '2025 RPD', '2025',
                '2026', '2027', '2028', '2029', '2030'
            ];
            kinerjaYears.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                elTahunFilter.appendChild(opt);
            });

            if (kinerjaYears.includes(currentYear) || currentYear === 'all') {
                elTahunFilter.value = currentYear;
            } else {
                elTahunFilter.value = 'all';
            }
            state.activeFilters.tahun = elTahunFilter.value;
        } else {
            const tahunSet = new Set();
            BUDGET_DATA.forEach(row => {
                if (row.tahun) tahunSet.add(row.tahun);
            });
            const budgetYears = Array.from(tahunSet).sort();
            budgetYears.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                elTahunFilter.appendChild(opt);
            });

            if (currentYear === '2025 RPD' || currentYear === '2025 (RPD)') {
                elTahunFilter.value = '2025';
            } else if (budgetYears.includes(Number(currentYear)) || budgetYears.includes(currentYear) || currentYear === 'all') {
                elTahunFilter.value = currentYear;
            } else {
                elTahunFilter.value = 'all';
            }
            state.activeFilters.tahun = elTahunFilter.value;
        }
    }

    function initFilterOptions() {
        const jenisSet = new Set();
        const bidangSet = new Set();
        const programSet = new Set();

        BUDGET_DATA.forEach(row => {
            if (row.jenisAnggaran) jenisSet.add(row.jenisAnggaran);
            if (row.bidangUpt) bidangSet.add(row.bidangUpt);
            if (row.program) programSet.add(row.program);
        });

        // Populate Tahun (Standard financial years by default)
        updateYearFilterOptions(false);

        // Populate Jenis Anggaran
        Array.from(jenisSet).sort().forEach(j => {
            const opt = document.createElement('option');
            opt.value = j;
            opt.textContent = j;
            elJenisFilter.appendChild(opt);
        });

        // Populate Bidang
        Array.from(bidangSet).sort().forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            elBidangFilter.appendChild(opt);
        });

        // Populate Program
        Array.from(programSet).sort().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            elProgramFilter.appendChild(opt);
        });

        // Set default value for Year filter
        elTahunFilter.value = state.activeFilters.tahun;
    }

    // 4. Filter logic
    function applyFilters() {
        console.log("Applying filters. Active filters state:", state.activeFilters);
        state.filteredData = BUDGET_DATA.filter(row => {
            const matchTahun = state.activeFilters.tahun === 'all' || 
                               row.tahun.toString() === state.activeFilters.tahun ||
                               (state.activeFilters.tahun === '2025 RPD' && row.tahun.toString() === '2025');
            const matchJenis = state.activeFilters.jenisAnggaran === 'all' || row.jenisAnggaran === state.activeFilters.jenisAnggaran;
            const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
            const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
            
            let matchSearch = true;
            if (state.activeFilters.search.trim() !== '') {
                const query = state.activeFilters.search.toLowerCase();
                matchSearch = row.program.toLowerCase().includes(query) ||
                              row.kegiatan.toLowerCase().includes(query) ||
                              row.subkegiatan.toLowerCase().includes(query) ||
                              row.bidangUpt.toLowerCase().includes(query) ||
                              row.kodeSubkegiatan.toLowerCase().includes(query) ||
                              (row.catatan && row.catatan.toLowerCase().includes(query));
            }

            return matchTahun && matchJenis && matchBidang && matchProgram && matchSearch;
        });

        console.log(`Filtered data items count: ${state.filteredData.length}`);

        // Apply sorting
        sortData();
        
        // Reset pagination
        state.pagination.currentPage = 1;

        // Update view
        updateKPIs();
        updateCharts();
        renderTable();
        renderMappingTab();
        renderRealisasiTab();
        updateInsights();
        renderTargetKinerjaTab();
        renderPaketTab();

        // Update active filter badge on FAB & Header Year Display
        const badge = document.getElementById('active-filter-badge');
        if (badge) {
            const hasActiveFilters = 
                state.activeFilters.tahun !== '2026' ||
                state.activeFilters.jenisAnggaran !== 'all' ||
                state.activeFilters.bidangUpt !== 'all' ||
                state.activeFilters.program !== 'all' ||
                state.activeFilters.search.trim() !== '';

            if (hasActiveFilters) {
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }

        const elHeaderYear = document.getElementById('header-active-year');
        if (elHeaderYear) {
            const yr = state.activeFilters.tahun === 'all' ? 'Semua Tahun' : `Tahun Anggaran ${state.activeFilters.tahun}`;
            elHeaderYear.textContent = yr;
        }
    }

    // 5. Sorting logic
    function sortData() {
        const col = state.sorting.column;
        const dir = state.sorting.direction === 'asc' ? 1 : -1;

        state.filteredData.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            // Handle string comparisons case-insensitively
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
    }

    // Handle Table Header Click for Sorting
    document.querySelectorAll('.custom-table th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-column');
            if (state.sorting.column === col) {
                state.sorting.direction = state.sorting.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sorting.column = col;
                state.sorting.direction = 'asc';
            }

            // Update header class
            document.querySelectorAll('.custom-table th[data-column]').forEach(el => {
                el.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(state.sorting.direction === 'asc' ? 'sort-asc' : 'sort-desc');

            sortData();
            renderTable();
        });
    });

    // Helper to determine the target jenisAnggaran for a given year when filter is 'all'
    function getTargetJenisAnggaranForYear(year) {
        const y = parseInt(year);
        // Check if BUDGET_DATA has exact 'P-APBD' for this year
        const hasPapbd = BUDGET_DATA.some(r => r.tahun === y && r.jenisAnggaran === 'P-APBD');
        return hasPapbd ? 'P-APBD' : 'APBD';
    }

    // Helper to check if a row falls within the active definitive budget scope
    function isRowInActiveSummaryScope(row) {
        if (state.activeFilters.jenisAnggaran !== 'all') {
            return row.jenisAnggaran === state.activeFilters.jenisAnggaran;
        }
        return row.jenisAnggaran === getTargetJenisAnggaranForYear(row.tahun);
    }

    // Helper to calculate budget for specific year and type with active filters (excluding year)
    function getBudgetForYear(year, jenis) {
        const dataForYear = BUDGET_DATA.filter(row => {
            const matchTahun = row.tahun === year;
            const matchJenis = state.activeFilters.jenisAnggaran === 'all' || row.jenisAnggaran === state.activeFilters.jenisAnggaran;
            const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
            const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
            
            let matchSearch = true;
            if (state.activeFilters.search.trim() !== '') {
                const query = state.activeFilters.search.toLowerCase();
                matchSearch = row.program.toLowerCase().includes(query) ||
                              row.kegiatan.toLowerCase().includes(query) ||
                              row.subkegiatan.toLowerCase().includes(query) ||
                              row.bidangUpt.toLowerCase().includes(query) ||
                              row.kodeSubkegiatan.toLowerCase().includes(query) ||
                              (row.catatan && row.catatan.toLowerCase().includes(query));
            }

            return matchTahun && matchJenis && matchBidang && matchProgram && matchSearch;
        });

        return dataForYear.reduce((sum, item) => {
            if (jenis === 'APBD' && item.jenisAnggaran === 'APBD') return sum + item.anggaran;
            if (jenis === 'P-APBD' && item.jenisAnggaran === 'P-APBD') return sum + item.anggaran;
            return sum;
        }, 0);
    }

    // 6. Update KPI summary cards & Ringkasan Dashboard
    function updateKPIs() {
        let totalApbd = 0;
        let totalPapbd = 0;
        let totalBudget = 0;
        let totalRealisasi = 0;

        const programSet = new Set();
        const kegiatanSet = new Set();
        const subkegiatanSet = new Set();

        state.filteredData.forEach(row => {
            if (row.jenisAnggaran === 'APBD') totalApbd += row.anggaran || 0;
            if (row.jenisAnggaran === 'P-APBD') totalPapbd += row.anggaran || 0;

            // Jika filter jenis anggaran adalah 'all', card Total Anggaran & Realisasi menggunakan data P-APBD (atau APBD jika tahun tsb belum memiliki P-APBD seperti 2026)
            if (isRowInActiveSummaryScope(row)) {
                totalBudget += row.anggaran || 0;
                totalRealisasi += row.realisasi || 0;

                if (row.program) programSet.add(row.program);
                if (row.kegiatan) kegiatanSet.add(row.kegiatan);
                if (row.subkegiatan) subkegiatanSet.add(row.subkegiatan);
            }
        });

        // Animation for counter (Legacy & New layout compatible)
        animateValue(elTotalApbd, totalApbd, true);
        animateValue(elTotalPapbd, totalPapbd, true);
        animateValue(elTotalProgram, programSet.size, false);
        animateValue(elTotalKegiatan, kegiatanSet.size, false);
        animateValue(elTotalSubkegiatan, subkegiatanSet.size, false);

        // Update Top 4 Summary Cards (Reference Design)
        const elKpiBudget = document.getElementById('kpi-summary-budget');
        const elKpiRealisasi = document.getElementById('kpi-summary-realisasi');
        const elKpiRemaining = document.getElementById('kpi-summary-remaining');
        const elKpiPrograms = document.getElementById('kpi-summary-programs');

        const remainingBudget = Math.max(0, totalBudget - totalRealisasi);
        const realisasiPct = totalBudget > 0 ? Math.min(100, (totalRealisasi / totalBudget * 100)) : 0;
        const remainingPct = totalBudget > 0 ? (remainingBudget / totalBudget * 100) : 0;

        if (elKpiBudget) elKpiBudget.textContent = formatRupiah(totalBudget);
        if (elKpiRealisasi) elKpiRealisasi.textContent = formatRupiah(totalRealisasi);
        if (elKpiRemaining) elKpiRemaining.textContent = formatRupiah(remainingBudget);
        if (elKpiPrograms) elKpiPrograms.textContent = programSet.size;

        const elKpiPencapaian = document.getElementById('kpi-summary-pencapaian') || document.getElementById('kpi-summary-rate');
        const elKpiPencapaianBar = document.getElementById('kpi-summary-pencapaian-progress') || document.getElementById('kpi-summary-rate-progress');
        const elKpiPencapaianSub = document.getElementById('kpi-summary-pencapaian-sub') || document.getElementById('kpi-summary-rate-sub');
        if (elKpiPencapaian) elKpiPencapaian.textContent = `${realisasiPct.toFixed(1)}%`;
        if (elKpiPencapaianBar) elKpiPencapaianBar.style.width = `${Math.min(100, realisasiPct)}%`;
        if (elKpiPencapaianSub) {
            if (realisasiPct >= 80) {
                elKpiPencapaianSub.textContent = 'Efektivitas Sangat Baik';
            } else if (realisasiPct >= 50) {
                elKpiPencapaianSub.textContent = 'Efektivitas Cukup';
            } else {
                elKpiPencapaianSub.textContent = 'Perlu Akselerasi';
            }
        }

        const elKpiGrowth = document.getElementById('kpi-summary-growth');
        const elKpiGrowthBar = document.getElementById('kpi-summary-growth-progress');
        const elKpiGrowthSub = document.getElementById('kpi-summary-growth-sub');

        const elBudgetSub = document.getElementById('kpi-summary-budget-sub');
        if (elBudgetSub) {
            if (state.activeFilters.tahun !== 'all') {
                const activeYear = parseInt(state.activeFilters.tahun);
                const prevYear = activeYear - 1;
                
                const targetPrevJenis = state.activeFilters.jenisAnggaran !== 'all' 
                    ? state.activeFilters.jenisAnggaran 
                    : getTargetJenisAnggaranForYear(prevYear);

                const prevBudget = BUDGET_DATA.filter(row => {
                    const matchTahun = row.tahun === prevYear;
                    const matchJenis = row.jenisAnggaran === targetPrevJenis;
                    const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
                    const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
                    let matchSearch = true;
                    if (state.activeFilters.search.trim() !== '') {
                        const query = state.activeFilters.search.toLowerCase();
                        matchSearch = (row.program && row.program.toLowerCase().includes(query)) ||
                                      (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                                      (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                                      (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query));
                    }
                    return matchTahun && matchJenis && matchBidang && matchProgram && matchSearch;
                }).reduce((sum, item) => sum + (item.anggaran || 0), 0);

                if (prevBudget > 0) {
                    const diffPct = ((totalBudget - prevBudget) / prevBudget * 100);
                    const sign = diffPct >= 0 ? '+' : '';
                    const colorCls = diffPct >= 0 ? 'text-success' : 'text-danger';
                    const iconArrow = diffPct >= 0 ? 'bi-arrow-up-short' : 'bi-arrow-down-short';
                    elBudgetSub.innerHTML = `<span class="${colorCls} fw-bold"><i class="bi ${iconArrow}"></i>${sign}${diffPct.toFixed(1)}%</span> vs tahun ${prevYear}`;
                    if (elKpiGrowth) {
                        elKpiGrowth.textContent = `${sign}${diffPct.toFixed(1)}%`;
                        if (elKpiGrowthBar) elKpiGrowthBar.style.width = `${Math.min(100, Math.max(10, Math.abs(diffPct)))}%`;
                        if (elKpiGrowthSub) elKpiGrowthSub.textContent = `vs tahun ${prevYear}`;
                    }
                } else {
                    elBudgetSub.innerHTML = `<span class="text-muted">Basis thn awal</span>`;
                    if (elKpiGrowth) {
                        elKpiGrowth.textContent = 'N/A';
                        if (elKpiGrowthBar) elKpiGrowthBar.style.width = '0%';
                        if (elKpiGrowthSub) elKpiGrowthSub.textContent = 'Basis tahun awal';
                    }
                }
            } else {
                elBudgetSub.innerHTML = `<span class="text-muted">Akumulasi seluruh tahun</span>`;
                if (elKpiGrowth) {
                    elKpiGrowth.textContent = 'Semua';
                    if (elKpiGrowthBar) elKpiGrowthBar.style.width = '100%';
                    if (elKpiGrowthSub) elKpiGrowthSub.textContent = 'Semua tahun terpilih';
                }
            }
        }

        const elRealisasiPct = document.getElementById('kpi-summary-realisasi-pct');
        const elRealisasiBar = document.getElementById('kpi-summary-realisasi-progress');
        if (elRealisasiPct) elRealisasiPct.textContent = `${realisasiPct.toFixed(2)}% dari total anggaran`;
        if (elRealisasiBar) elRealisasiBar.style.width = `${Math.min(100, realisasiPct)}%`;

        const elRemainingPct = document.getElementById('kpi-summary-remaining-pct');
        const elRemainingBar = document.getElementById('kpi-summary-remaining-progress');
        if (elRemainingPct) elRemainingPct.textContent = `${remainingPct.toFixed(2)}% dari total anggaran`;
        if (elRemainingBar) elRemainingBar.style.width = `${Math.min(100, remainingPct)}%`;

        // Update Footer Summary Strip on Bar Chart (Matching Reference Screenshot)
        const elLabelRealisasi = document.getElementById('summary-footer-label-realisasi');
        const elLabelTarget = document.getElementById('summary-footer-label-target');
        const elValRealisasi = document.getElementById('summary-footer-val-realisasi');
        const elValTarget = document.getElementById('summary-footer-val-target');
        const elAchievementCircle = document.getElementById('summary-achievement-circle');

        const activeYrText = state.activeFilters.tahun === 'all' ? 'Semua Tahun' : state.activeFilters.tahun;
        if (elLabelRealisasi) elLabelRealisasi.textContent = `Realisasi s.d. ${activeYrText}`;
        if (elLabelTarget) elLabelTarget.textContent = `Target s.d. ${activeYrText}`;
        if (elValRealisasi) {
            elValRealisasi.textContent = formatShortRupiah(totalRealisasi);
            elValRealisasi.title = formatRupiah(totalRealisasi);
        }
        if (elValTarget) {
            elValTarget.textContent = formatShortRupiah(totalBudget);
            elValTarget.title = formatRupiah(totalBudget);
        }
        if (elAchievementCircle) {
            elAchievementCircle.textContent = `${realisasiPct.toFixed(1)}%`;
            const badgeCard = elAchievementCircle.closest('.footer-strip-badge-card');
            if (badgeCard) {
                if (realisasiPct >= 80) {
                    badgeCard.style.background = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
                    badgeCard.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
                } else if (realisasiPct >= 50) {
                    badgeCard.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                    badgeCard.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
                } else {
                    badgeCard.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                    badgeCard.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.35)';
                }
            }
        }

        // Update Top 5 Program List
        renderTopProgramsList();

        // Update Donut Center & Legend
        const elDonutCenter = document.getElementById('donut-center-amount');
        if (elDonutCenter) elDonutCenter.textContent = formatShortRupiah(totalRealisasi > 0 ? totalRealisasi : totalBudget);

        // YoY Change Calculation
        if (state.activeFilters.tahun !== 'all') {
            const activeYear = parseInt(state.activeFilters.tahun);
            const prevYear = activeYear - 1;

            const prevApbd = getBudgetForYear(prevYear, 'APBD');
            if (prevApbd > 0 && elApbdYoY) {
                const diffApbd = ((totalApbd - prevApbd) / prevApbd * 100);
                const sign = diffApbd >= 0 ? '+' : '';
                const cls = diffApbd >= 0 ? 'text-success fw-semibold' : 'text-danger fw-semibold';
                elApbdYoY.innerHTML = `<span class="${cls}"><i class="bi bi-arrow-${diffApbd >= 0 ? 'up' : 'down'}"></i> ${sign}${diffApbd.toFixed(1)}%</span> vs thn lalu`;
            } else if (elApbdYoY) {
                elApbdYoY.innerHTML = `<span class="text-muted">N/A (Thn pertama)</span>`;
            }
        } else if (elApbdYoY) {
            elApbdYoY.innerHTML = `<span class="text-muted"><i class="bi bi-info-circle"></i> Akumulasi semua tahun</span>`;
        }

        // P-APBD vs APBD of the same year (under active filters)
        if (totalApbd > 0 && totalPapbd > 0 && elPapbdYoY) {
            const diffPapbd = ((totalPapbd - totalApbd) / totalApbd * 100);
            const sign = diffPapbd >= 0 ? '+' : '';
            const cls = diffPapbd >= 0 ? 'text-success fw-semibold' : 'text-danger fw-semibold';
            elPapbdYoY.innerHTML = `<span class="${cls}"><i class="bi bi-arrow-${diffPapbd >= 0 ? 'up' : 'down'}"></i> ${sign}${diffPapbd.toFixed(1)}%</span> vs APBD murni`;
        } else if (elPapbdYoY) {
            elPapbdYoY.innerHTML = `<span class="text-muted">N/A (Belum ada P-APBD)</span>`;
        }
    }

    // Render Top 5 Items List for Hierarchy (Program, Kegiatan, Subkegiatan)
    function renderHierarchyList(mode, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const groups = {};
        state.filteredData.forEach(row => {
            if (!isRowInActiveSummaryScope(row)) return;
            let name = '';
            if (mode === 'kegiatan') {
                name = row.kegiatan;
            } else if (mode === 'subkegiatan') {
                name = row.subkegiatan;
            } else {
                name = row.program;
            }

            // Exclude empty names, "Tanpa Program", "Tanpa Kegiatan", "Tanpa Subkegiatan"
            if (!name || name.trim() === '' || name.toLowerCase().includes('tanpa program') || name.toLowerCase().includes('tanpa kegiatan') || name.toLowerCase().includes('tanpa subkegiatan')) {
                return;
            }

            if (!groups[name]) {
                groups[name] = { name, budget: 0, realisasi: 0 };
            }
            groups[name].budget += row.anggaran || 0;
            groups[name].realisasi += row.realisasi || 0;
        });

        const sorted = Object.values(groups).map(p => {
            const pct = p.budget > 0 ? Math.min(100, (p.realisasi / p.budget * 100)) : 0;
            return { ...p, pct };
        }).sort((a, b) => (b.realisasi || b.budget) - (a.realisasi || a.budget)).slice(0, 5);

        const colorSchemes = [
            { rankClass: 'rank-badge-1', barClass: 'progress-bar-gradient-emerald', badgeClass: 'bg-success-subtle text-success border border-success-subtle' },
            { rankClass: 'rank-badge-2', barClass: 'progress-bar-gradient-blue', badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle' },
            { rankClass: 'rank-badge-3', barClass: 'progress-bar-gradient-amber', badgeClass: 'bg-warning-subtle text-warning border border-warning-subtle' },
            { rankClass: 'rank-badge-other', barClass: 'progress-bar-gradient-purple', badgeClass: 'bg-purple-subtle text-purple border border-purple-subtle' },
            { rankClass: 'rank-badge-other', barClass: 'progress-bar-gradient-teal', badgeClass: 'bg-info-subtle text-info border border-info-subtle' }
        ];

        if (sorted.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-4 text-xs">Tidak ada data untuk rincian ini.</div>`;
            return;
        }

        container.innerHTML = sorted.map((p, idx) => {
            const scheme = colorSchemes[idx % colorSchemes.length];
            const displayVal = p.realisasi > 0 ? p.realisasi : p.budget;
            return `
                <div class="top-hierarchy-item">
                    <div class="d-flex align-items-center justify-content-between gap-2">
                        <div class="d-flex align-items-center gap-2 flex-grow-1" style="min-width: 0;">
                            <span class="top-hierarchy-rank ${scheme.rankClass}">${idx + 1}</span>
                            <span class="fw-bold text-dark text-xs text-truncate" title="${p.name}">${p.name}</span>
                        </div>
                        <span class="badge ${scheme.badgeClass} rounded-pill px-2 py-0.5 fw-bold flex-shrink-0" style="font-size: 0.65rem;">
                            ${p.pct.toFixed(1)}%
                        </span>
                    </div>
                    <div class="progress" style="height: 5px; background-color: #f1f5f9; border-radius: 999px;">
                        <div class="progress-bar ${scheme.barClass}" role="progressbar" style="width: ${Math.min(100, Math.max(6, p.pct))}%; border-radius: 999px;"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 0.72rem; line-height: 1.2;">
                        <span>Realisasi: <strong class="text-dark">${formatShortRupiah(displayVal)}</strong></span>
                        <span>Pagu: <strong>${formatShortRupiah(p.budget)}</strong></span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTopProgramsList() {
        renderHierarchyList('program', 'top-program-list-container');
        renderHierarchyList('kegiatan', 'top-kegiatan-list-container');
        renderHierarchyList('subkegiatan', 'top-subkegiatan-list-container');
    }

    function animateValue(obj, endVal, isCurrency) {
        if (!obj) return;
        let startVal = 0;
        // Strip non-numbers if there is current value, default to 0
        const duration = 500;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out quad
            const ease = progress * (2 - progress);
            const currentVal = Math.round(startVal + ease * (endVal - startVal));
            
            if (isCurrency) {
                obj.textContent = formatShortRupiah(currentVal);
                obj.title = formatRupiah(endVal);
            } else {
                obj.textContent = currentVal.toLocaleString('id-ID');
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                // final value
                if (isCurrency) {
                    obj.textContent = formatShortRupiah(endVal);
                    obj.title = formatRupiah(endVal);
                } else {
                    obj.textContent = endVal.toLocaleString('id-ID');
                }
            }
        }
        requestAnimationFrame(update);
    }

    // 7. Render dynamic insights
    function updateInsights() {
        if (state.filteredData.length === 0) {
            elInsightConcentration.innerHTML = `<div class="insight-item-title">Data kosong</div><div class="insight-item-desc">Silakan sesuaikan filter Anda.</div>`;
            elInsightYoY.innerHTML = `<div class="insight-item-title">Data kosong</div><div class="insight-item-desc">Silakan sesuaikan filter Anda.</div>`;
            elInsightEfficiency.innerHTML = `<div class="insight-item-title">Data kosong</div><div class="insight-item-desc">Silakan sesuaikan filter Anda.</div>`;
            return;
        }

        // --- Concentration Analysis (CR3) ---
        const bidangBudgets = {};
        let totalBudget = 0;
        state.filteredData.forEach(row => {
            if (isRowInActiveSummaryScope(row)) {
                if (row.bidangUpt) {
                    bidangBudgets[row.bidangUpt] = (bidangBudgets[row.bidangUpt] || 0) + row.anggaran;
                    totalBudget += row.anggaran;
                }
            }
        });

        const sortedBidang = Object.entries(bidangBudgets).sort((a, b) => b[1] - a[1]);
        const totalTop3 = sortedBidang.slice(0, 3).reduce((sum, item) => sum + item[1], 0);
        const cr3Ratio = totalBudget > 0 ? (totalTop3 / totalBudget * 100) : 0;
        
        let cr3HTML = `<div class="insight-item-title">Indeks Konsentrasi Anggaran (CR3): ${cr3Ratio.toFixed(1)}%</div>`;
        cr3HTML += `<div class="insight-item-desc">Tiga unit kerja teratas menguasai <strong>${cr3Ratio.toFixed(1)}%</strong> anggaran tersaring. `;
        if (sortedBidang.length > 0) {
            cr3HTML += `Dominasi terbesar dipegang oleh <strong>${sortedBidang[0][0]}</strong> dengan porsi <strong>${(totalBudget > 0 ? (sortedBidang[0][1] / totalBudget * 100) : 0).toFixed(1)}%</strong> (${formatShortRupiah(sortedBidang[0][1])}).`;
        }
        cr3HTML += `</div>`;
        elInsightConcentration.innerHTML = cr3HTML;

        // --- YoY Growth Analysis ---
        const yearBudgets = { 2024: 0, 2025: 0, 2026: 0 };
        state.filteredData.forEach(row => {
            if (isRowInActiveSummaryScope(row)) {
                if (yearBudgets[row.tahun] !== undefined) {
                    yearBudgets[row.tahun] += row.anggaran;
                }
            }
        });

        let yoyHTML = `<div class="insight-item-title">Tren Pertumbuhan Anggaran (YoY)</div>`;
        yoyHTML += `<div class="insight-item-desc">`;
        
        // Calculate 2024 -> 2025
        if (yearBudgets[2024] > 0 && yearBudgets[2025] > 0) {
            const growth25 = ((yearBudgets[2025] - yearBudgets[2024]) / yearBudgets[2024] * 100);
            const sign25 = growth25 >= 0 ? '+' : '';
            yoyHTML += `• 2024 ke 2025: <strong>${sign25}${growth25.toFixed(1)}%</strong> (${formatShortRupiah(yearBudgets[2024])} &rarr; ${formatShortRupiah(yearBudgets[2025])})<br>`;
        } else {
            yoyHTML += `• 2024 ke 2025: Data tidak cukup untuk perbandingan.<br>`;
        }
        
        // Calculate 2025 -> 2026
        if (yearBudgets[2025] > 0 && yearBudgets[2026] > 0) {
            const growth26 = ((yearBudgets[2026] - yearBudgets[2025]) / yearBudgets[2025] * 100);
            const sign26 = growth26 >= 0 ? '+' : '';
            yoyHTML += `• 2025 ke 2026: <strong>${sign26}${growth26.toFixed(1)}%</strong> (${formatShortRupiah(yearBudgets[2025])} &rarr; ${formatShortRupiah(yearBudgets[2026])})`;
        } else {
            yoyHTML += `• 2025 ke 2026: Data tidak cukup untuk perbandingan.`;
        }
        yoyHTML += `</div>`;
        elInsightYoY.innerHTML = yoyHTML;

        // --- Zero-Budget Activities Analysis ---
        const activeScopeRows = state.filteredData.filter(isRowInActiveSummaryScope);
        const totalItems = activeScopeRows.length;
        const zeroItems = activeScopeRows.filter(row => row.anggaran === 0).length;
        const zeroPct = totalItems > 0 ? (zeroItems / totalItems * 100) : 0;

        let effHTML = `<div class="insight-item-title">Analisis Kegiatan Non-Anggaran (Zero Budget)</div>`;
        effHTML += `<div class="insight-item-desc">Terdapat <strong>${zeroItems} dari ${totalItems}</strong> subkegiatan (<strong>${zeroPct.toFixed(1)}%</strong>) dengan nilai anggaran Rp 0. `;
        if (zeroItems > 0) {
            effHTML += `Ini menunjukkan keberadaan program standby, perencanaan regulatif tanpa belanja langsung, atau kegiatan administratif pendukung.`;
        } else {
            effHTML += `Semua program yang disaring dialokasikan dana belanja aktif (> Rp 0).`;
        }
        effHTML += `</div>`;
        elInsightEfficiency.innerHTML = effHTML;
    }

    // 8. Render Table
    function renderTable() {
        const elDaftarPaguTitle = document.getElementById('title-daftar-pagu-text');
        if (elDaftarPaguTitle) {
            const yearText = state.activeFilters.tahun === 'all' ? '(Semua Tahun)' : `Tahun ${state.activeFilters.tahun}`;
            elDaftarPaguTitle.textContent = `Daftar Pagu Anggaran ${yearText}`;
        }

        const startIdx = (state.pagination.currentPage - 1) * state.pagination.limit;
        const endIdx = Math.min(startIdx + state.pagination.limit, state.filteredData.length);
        const paginatedData = state.filteredData.slice(startIdx, endIdx);

        elTableBody.innerHTML = '';
        
        if (paginatedData.length === 0) {
            elTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        Tidak ada data anggaran yang cocok dengan filter aktif.
                    </td>
                </tr>
            `;
            elTableSummary.textContent = `Menampilkan 0 data`;
            renderPagination(0);
            return;
        }

        paginatedData.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'clickable-row-item';
            
            const badgeClass = row.jenisAnggaran === 'APBD' ? 'badge-apbd' : 'badge-p-apbd';
            const budgetClass = row.anggaran === 0 ? 'text-danger fw-normal' : 'fw-semibold text-dark';
            const budgetText = row.anggaran === 0 ? 'Rp 0' : formatRupiah(row.anggaran);

            tr.innerHTML = `
                <td class="text-center text-muted">${row.no}</td>
                <td>
                    <span class="fw-medium text-dark">${row.bidangUpt}</span>
                </td>
                <td>
                    <div class="text-truncate-hover" title="${row.program}">${row.program}</div>
                    <div class="text-muted text-xs">${row.kodeProgram}</div>
                </td>
                <td>
                    <div class="text-truncate-hover" title="${row.kegiatan}">${row.kegiatan}</div>
                    <div class="text-muted text-xs">${row.kodeKegiatan}</div>
                </td>
                <td>
                    <div class="text-truncate-hover" title="${row.subkegiatan}">${row.subkegiatan}</div>
                    <div class="text-muted text-xs">${row.kodeSubkegiatan}</div>
                </td>
                <td class="text-center">
                    <span class="badge badge-custom ${badgeClass}">${row.jenisAnggaran}</span>
                </td>
                <td class="text-center">${row.tahun}</td>
                <td class="text-end ${budgetClass}">${budgetText}</td>
            `;
            
            tr.addEventListener('click', () => {
                showRowDetails(row.no);
            });
            
            elTableBody.appendChild(tr);
        });

        // Summary text
        elTableSummary.textContent = `Menampilkan ${startIdx + 1} s.d ${endIdx} dari ${state.filteredData.length.toLocaleString('id-ID')} data`;
        
        // Render pagination buttons
        renderPagination(state.filteredData.length);
    }

    function renderPagination(totalItems) {
        elPaginationContainer.innerHTML = '';
        const totalPages = Math.ceil(totalItems / state.pagination.limit);
        if (totalPages <= 1) return;

        const maxVisiblePages = 5;
        let startPage = Math.max(1, state.pagination.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Prev button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${state.pagination.currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Sebelumnya"><span aria-hidden="true">&laquo;</span></a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.pagination.currentPage > 1) {
                state.pagination.currentPage--;
                renderTable();
            }
        });
        elPaginationContainer.appendChild(prevLi);

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${state.pagination.currentPage === i ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                state.pagination.currentPage = i;
                renderTable();
            });
            elPaginationContainer.appendChild(li);
        }

        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${state.pagination.currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Selanjutnya"><span aria-hidden="true">&raquo;</span></a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.pagination.currentPage < totalPages) {
                state.pagination.currentPage++;
                renderTable();
            }
        });
        elPaginationContainer.appendChild(nextLi);
    }

    // Handle Limit change
    elTableLimit.addEventListener('change', function () {
        state.pagination.limit = parseInt(this.value);
        state.pagination.currentPage = 1;
        renderTable();
    });

    function updateCharts() {
        console.log("updateCharts: started grouping data. Input rows:", state.filteredData.length);
        // Group data for each chart
        const bidangGroups = {};
        const jenisGroups = {};
        const programGroups = {};
        const subkegiatanGroups = {};

        state.filteredData.forEach(row => {
            // For Ringkasan summary charts, scope to the active definitive budget
            if (!isRowInActiveSummaryScope(row)) return;

            // Bidang/UPT
            if (row.bidangUpt) {
                bidangGroups[row.bidangUpt] = (bidangGroups[row.bidangUpt] || 0) + row.anggaran;
            }
            // Jenis Anggaran
            if (row.jenisAnggaran) {
                jenisGroups[row.jenisAnggaran] = (jenisGroups[row.jenisAnggaran] || 0) + row.anggaran;
            }
            // Program Detail
            if (row.program) {
                programGroups[row.program] = (programGroups[row.program] || 0) + row.anggaran;
            }
            // Subkegiatan Detail
            if (row.subkegiatan) {
                subkegiatanGroups[row.subkegiatan] = (subkegiatanGroups[row.subkegiatan] || 0) + row.anggaran;
            }
        });

        // Build trend chart data (Pagu Anggaran vs Realisasi 2021-2026)
        let sortedCategories = [];
        const activeYears = [2021, 2022, 2023, 2024, 2025, 2026];
        const categoryMap = {};
        activeYears.forEach(y => {
            categoryMap[y] = {
                key: y.toString(),
                label: y.toString(),
                tahun: y,
                anggaran: 0,
                realisasi: 0,
                capaian: null
            };
        });

            // Filter BUDGET_DATA according to active filters (jenisAnggaran, bidangUpt, program, search)
            const trendFilteredData = BUDGET_DATA.filter(row => {
                const matchJenis = state.activeFilters.jenisAnggaran === 'all' || row.jenisAnggaran === state.activeFilters.jenisAnggaran;
                const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
                const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
                
                let matchSearch = true;
                if (state.activeFilters.search.trim() !== '') {
                    const query = state.activeFilters.search.toLowerCase();
                    matchSearch = (row.program && row.program.toLowerCase().includes(query)) ||
                                  (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                                  (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                                  (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query)) ||
                                  (row.kodeSubkegiatan && row.kodeSubkegiatan.toLowerCase().includes(query)) ||
                                  (row.catatan && row.catatan.toLowerCase().includes(query));
                }

                return matchJenis && matchBidang && matchProgram && matchSearch;
            });

            trendFilteredData.forEach(row => {
                if (row.tahun && categoryMap[row.tahun]) {
                    if (isRowInActiveSummaryScope(row)) {
                        categoryMap[row.tahun].anggaran += row.anggaran || 0;
                        categoryMap[row.tahun].realisasi += row.realisasi || 0;
                    }
                }
            });

            // Calculate capaian percentage for each year (null if no realization yet)
            Object.values(categoryMap).forEach(cat => {
                cat.capaian = (cat.anggaran > 0 && cat.realisasi > 0) ? parseFloat((cat.realisasi / cat.anggaran * 100).toFixed(2)) : null;
            });

            sortedCategories = Object.values(categoryMap);

        console.log("updateCharts: Grouped Bidang count:", Object.keys(bidangGroups).length);
        console.log("updateCharts: Grouped Program count:", Object.keys(programGroups).length);
        console.log("updateCharts: Grouped Subkegiatan count:", Object.keys(subkegiatanGroups).length);

        // Sort programGroups by budget and keep top 8, group the rest as "Program Lainnya"
        const sortedPrograms = Object.entries(programGroups).sort((a, b) => b[1] - a[1]);
        const displayPrograms = {};
        let otherProgBudget = 0;

        sortedPrograms.forEach(([key, val], idx) => {
            if (idx < 8) {
                displayPrograms[key] = val;
            } else {
                otherProgBudget += val;
            }
        });

        if (otherProgBudget > 0) {
            displayPrograms['Program Lainnya'] = otherProgBudget;
        }

        // Sort subkegiatanGroups by budget and keep top 8, group the rest as "Subkegiatan Lainnya"
        const sortedSubkegiatans = Object.entries(subkegiatanGroups).sort((a, b) => b[1] - a[1]);
        const displaySubkegiatans = {};
        let otherSubBudget = 0;

        sortedSubkegiatans.forEach(([key, val], idx) => {
            if (idx < 8) {
                displaySubkegiatans[key] = val;
            } else {
                otherSubBudget += val;
            }
        });

        if (otherSubBudget > 0) {
            displaySubkegiatans['Subkegiatan Lainnya'] = otherSubBudget;
        }

        // Chart 1: Realisasi Anggaran (Barchart Pagu vs Realisasi per Tahun & Jenis)
        renderTrendChart(sortedCategories);
        
        // Chart 2: Bidang/UPT
        renderBidangChart(bidangGroups);
        
        // Chart 3: Proporsi Bidang/UPT
        renderBidangPropChart(bidangGroups);
        renderRincianSemuaUnitKerjaTable();

        // Chart 4: Komposisi Program
        renderProgramChart(displayPrograms);

        // Chart 5: Komposisi Subkegiatan
        renderSubkegiatanChart(displaySubkegiatans);

        // Charts on Anggaran Tab (Tab 3)
        renderAnggaranTabCharts();
    }

    function renderTrendChart(categories) {
        const elCanvas = document.getElementById('chart-trend');
        if (!elCanvas) return;

        const elTitle = document.getElementById('title-realisasi-trend');
        if (elTitle) {
            let yrText = '';
            if (state.activeFilters.tahun === 'all') {
                const minYear = (categories.length > 0 && categories[0].label) ? categories[0].label : '2021';
                const maxYear = (categories.length > 0 && categories[categories.length - 1].label) ? categories[categories.length - 1].label : '2026';
                yrText = `Tahun ${minYear} - ${maxYear}`;
            } else {
                yrText = `Tahun ${state.activeFilters.tahun}`;
            }
            elTitle.textContent = `Realisasi Pagu Anggaran ${yrText}`;
        }

        const ctx = elCanvas.getContext('2d');
        if (state.charts.trend) {
            state.charts.trend.destroy();
        }

        const labels = categories.map(c => c.label);
        const anggaranValues = categories.map(c => c.anggaran);
        const realisasiValues = categories.map(c => c.realisasi);
        const capaianValues = categories.map(c => (c.capaian !== undefined) ? c.capaian : (c.anggaran > 0 && c.realisasi > 0 ? parseFloat((c.realisasi / c.anggaran * 100).toFixed(2)) : null));
        const activeYear = state.activeFilters.tahun;

        // Custom plugin for rendering value labels on top of bars (Anggaran & Realisasi) and line points (Capaian)
        const trendTopValueLabels = {
            id: 'trendTopValueLabels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const val = dataset.data[index];
                        if (val !== undefined && val !== null && !isNaN(val)) {
                            const lbl = labels[index];
                            const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);

                            ctx.save();
                            ctx.textAlign = 'center';

                            if (dataset.type === 'line' || (dataset.label && dataset.label.includes('Capaian'))) {
                                // Capaian (Line): Nilai persentase di atas marker point jika ada nilai realisasi
                                if (val !== null && val !== undefined && val > 0) {
                                    ctx.font = isYearMatched ? '800 11.5px Poppins, sans-serif' : '500 8.5px Poppins, sans-serif';
                                    ctx.fillStyle = isYearMatched ? '#1d4ed8' : 'rgba(29, 78, 216, 0.32)';
                                    ctx.textBaseline = 'bottom';
                                    ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                    ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                    ctx.lineJoin = 'round';
                                    const valText = val.toFixed(1).replace('.', ',') + '%';
                                    ctx.strokeText(valText, element.x, element.y - (isYearMatched && activeYear !== 'all' ? 9 : 7));
                                    ctx.fillText(valText, element.x, element.y - (isYearMatched && activeYear !== 'all' ? 9 : 7));
                                }
                            } else if (dataset.label === 'Anggaran') {
                                // Anggaran (Bar): Nilai di atas bar
                                if (val > 0) {
                                    ctx.font = isYearMatched ? '700 10px Poppins, sans-serif' : '500 8px Poppins, sans-serif';
                                    ctx.fillStyle = isYearMatched ? '#b45309' : 'rgba(180, 83, 9, 0.32)';
                                    ctx.textBaseline = 'bottom';
                                    ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                    ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                    ctx.lineJoin = 'round';
                                    const valText = formatShortRupiah(val);
                                    ctx.strokeText(valText, element.x, element.y - 4);
                                    ctx.fillText(valText, element.x, element.y - 4);
                                }
                            } else if (dataset.label === 'Realisasi') {
                                // Realisasi (Bar): Nilai di atas bar jika ada
                                if (val > 0) {
                                    ctx.font = isYearMatched ? '700 10px Poppins, sans-serif' : '500 8px Poppins, sans-serif';
                                    ctx.fillStyle = isYearMatched ? '#059669' : 'rgba(5, 150, 105, 0.32)';
                                    ctx.textBaseline = 'bottom';
                                    ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                    ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                    ctx.lineJoin = 'round';
                                    const valText = formatShortRupiah(val);
                                    ctx.strokeText(valText, element.x, element.y - 4);
                                    ctx.fillText(valText, element.x, element.y - 4);
                                }
                            }
                            ctx.restore();
                        }
                    });
                });
            }
        };

        state.charts.trend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Capaian',
                        data: capaianValues,
                        yAxisID: 'y1',
                        borderColor: activeYear === 'all' ? '#2563eb' : 'rgba(37, 99, 235, 0.65)',
                        borderWidth: 2.5,
                        backgroundColor: '#ffffff',
                        spanGaps: false,
                        pointRadius: labels.map((l, idx) => {
                            if (capaianValues[idx] === null || capaianValues[idx] === undefined) return 0;
                            return (activeYear !== 'all' && l.toString() === activeYear) ? 7.5 : (activeYear === 'all' ? 5.5 : 4);
                        }),
                        pointHoverRadius: labels.map((l, idx) => (capaianValues[idx] === null || capaianValues[idx] === undefined ? 0 : 8)),
                        pointBackgroundColor: labels.map(l => (activeYear !== 'all' && l.toString() === activeYear) ? '#2563eb' : '#ffffff'),
                        pointBorderColor: labels.map(l => (activeYear !== 'all' && l.toString() === activeYear) ? '#ffffff' : (activeYear === 'all' ? '#2563eb' : 'rgba(37, 99, 235, 0.35)')),
                        pointBorderWidth: labels.map(l => (activeYear !== 'all' && l.toString() === activeYear) ? 3.5 : 2.5),
                        pointHoverBorderWidth: 3,
                        tension: 0.25,
                        fill: false,
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Anggaran',
                        data: anggaranValues,
                        yAxisID: 'y',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            const idx = context.dataIndex;
                            const lbl = labels[idx];
                            const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);
                            if (!isYearMatched) return 'rgba(245, 158, 11, 0.28)';
                            if (!chartArea) return '#f59e0b';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, '#fbbf24');
                            gradient.addColorStop(0.5, '#f59e0b');
                            gradient.addColorStop(1, '#d97706');
                            return gradient;
                        },
                        borderWidth: 0,
                        borderColor: 'transparent',
                        hoverBackgroundColor: '#d97706',
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom',
                        barPercentage: 0.82,
                        categoryPercentage: 0.65,
                        order: 2
                    },
                    {
                        type: 'bar',
                        label: 'Realisasi',
                        data: realisasiValues,
                        yAxisID: 'y',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            const idx = context.dataIndex;
                            const lbl = labels[idx];
                            const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);
                            if (!isYearMatched) return 'rgba(16, 185, 129, 0.28)';
                            if (!chartArea) return '#10b981';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, '#34d399');
                            gradient.addColorStop(0.5, '#10b981');
                            gradient.addColorStop(1, '#059669');
                            return gradient;
                        },
                        borderWidth: 0,
                        borderColor: 'transparent',
                        hoverBackgroundColor: '#059669',
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom',
                        barPercentage: 0.82,
                        categoryPercentage: 0.65,
                        order: 3
                    }
                ]
            },
            plugins: [trendTopValueLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 40,
                        bottom: 15,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: false // HTML legend rendered in header
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                if (context.dataset.type === 'line' || (context.dataset.label && context.dataset.label.includes('Capaian'))) {
                                    if (val === null || val === undefined) {
                                        return ` ${context.dataset.label}: Belum ada realisasi`;
                                    }
                                    return ` ${context.dataset.label}: ${val.toFixed(2).replace('.', ',')}%`;
                                }
                                if (val === null || val === undefined) return ` ${context.dataset.label}: -`;
                                return ` ${context.dataset.label}: ${formatRupiah(val)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        display: false,
                        beginAtZero: true,
                        grace: '90%',
                        grid: { display: false }
                    },
                    y1: {
                        display: false,
                        position: 'right',
                        min: 0,
                        max: 110,
                        grid: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: function(context) {
                                const val = context.tick ? context.tick.label : '';
                                const isMatched = activeYear !== 'all' && val === activeYear;
                                return {
                                    family: 'Poppins',
                                    size: 13,
                                    weight: isMatched ? '800' : '600'
                                };
                            },
                            color: function(context) {
                                const val = context.tick ? context.tick.label : '';
                                if (activeYear === 'all') return '#334155';
                                return val === activeYear ? '#0f172a' : '#94a3b8';
                            },
                            padding: 4
                        }
                    }
                }
            }
        });
    }

    function renderBidangChart(data) {
        const elCanvas = document.getElementById('chart-bidang');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.bidang) {
            state.charts.bidang.destroy();
        }

        // Sort bidang by budget and take top 8 (to avoid clutter)
        const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
        const displayData = sorted.slice(0, 8);
        const labels = displayData.map(item => item[0]);
        const values = displayData.map(item => item[1]);

        state.charts.bidang = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Anggaran',
                    data: values,
                    backgroundColor: 'rgba(6, 182, 212, 0.8)',
                    borderColor: 'rgba(6, 182, 212, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    barThickness: 24
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (e) => {
                    showAllBidangDetails();
                },
                onHover: (evt) => {
                    evt.chart.canvas.style.cursor = 'pointer';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Anggaran: ' + formatRupiah(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatShortRupiah(value);
                            },
                            font: { family: 'Poppins', size: 9 }
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Poppins', size: 10 }
                        }
                    }
                }
            }
        });
    }

    function renderBidangPropChart(data) {
        const elCanvas = document.getElementById('chart-jenis');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.jenis) {
            state.charts.jenis.destroy();
        }

        // Sort data descending and display all items directly without "Others" grouping
        const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(item => item[0]);
        const values = sorted.map(item => item[1]);

        // Map long UPT/Bidang names to shorter names for chart legend
        const shortLabels = labels.map(p => {
            let name = p;
            if (name.includes('UPT PENGELOLAAN JALAN DAN JEMBATAN')) {
                name = name.replace('UPT PENGELOLAAN JALAN DAN JEMBATAN', 'UPT PJJ');
            }
            if (name.length > 25) return name.substring(0, 22) + '...';
            return name;
        });

        // Expanded modern vibrant color palette for all Bidang/UPTs
        const colors = [
            '#3b82f6',   // Blue
            '#10b981',   // Emerald
            '#f59e0b',   // Amber
            '#8b5cf6',   // Purple
            '#06b6d4',   // Cyan
            '#ec4899',   // Pink
            '#f97316',   // Orange
            '#14b8a6',   // Teal
            '#6366f1',   // Indigo
            '#84cc16',   // Lime
            '#e11d48',   // Rose
            '#0284c7',   // Sky
            '#059669',   // Emerald dark
            '#7c3aed',   // Violet
            '#d97706',   // Amber dark
            '#64748b'    // Slate
        ];

        state.charts.jenis = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: shortLabels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#ffffff',
                    borderWidth: 2.5,
                    hoverBorderColor: '#ffffff',
                    hoverOffset: 6,
                    borderRadius: 5,
                    spacing: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '74%',
                animation: {
                    animateRotate: true,
                    animateScale: true
                },
                onClick: (e) => {
                    showAllBidangDetails();
                },
                onHover: (evt) => {
                    evt.chart.canvas.style.cursor = 'pointer';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) + '%' : '0%';
                                const originalLabel = labels[context.dataIndex];
                                return ` ${originalLabel}: ${formatRupiah(context.raw)} (${pct})`;
                            }
                        }
                    }
                }
            }
        });

        // Render Custom Right Legend
        const legendContainer = document.getElementById('donut-legend-container');
        if (legendContainer) {
            const totalSum = values.reduce((a, b) => a + b, 0);
            const legendItems = sorted.slice(0, 5);
            
            legendContainer.innerHTML = legendItems.map((item, idx) => {
                const label = item[0];
                const val = item[1];
                const pct = totalSum > 0 ? (val / totalSum * 100).toFixed(1) : '0';
                const color = colors[idx % colors.length];

                let shortName = label;
                if (shortName.includes('UPT PENGELOLAAN JALAN DAN JEMBATAN')) {
                    shortName = shortName.replace('UPT PENGELOLAAN JALAN DAN JEMBATAN', 'UPT PJJ');
                }
                if (shortName.length > 20) shortName = shortName.substring(0, 18) + '...';

                return `
                    <div class="d-flex align-items-center justify-content-between gap-2 py-1 border-bottom border-light">
                        <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 3px; background-color: ${color}; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"></span>
                            <span class="text-secondary fw-semibold text-truncate text-xs" title="${label}">${shortName}</span>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                            <span class="fw-bold text-dark text-xs">${formatShortRupiah(val)}</span>
                            <span class="badge bg-light text-secondary rounded-pill px-2 py-0.5 text-xxs font-monospace">${pct}%</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render Table "Rincian Alokasi Semua Unit Kerja" on Tab Ringkasan
    function renderRincianSemuaUnitKerjaTable() {
        const tableBody = document.getElementById('rincian-unit-kerja-table-body');
        const countBadge = document.getElementById('rincian-unit-kerja-count');
        if (!tableBody) return;

        const data = state.filteredData;
        const totalBudget = data.reduce((sum, r) => {
            if (!isRowInActiveSummaryScope(r)) return sum;
            return sum + (r.anggaran || 0);
        }, 0);

        const groups = {};
        data.forEach(r => {
            if (!isRowInActiveSummaryScope(r)) return;
            const org = r.bidangUpt || 'Lainnya';
            if (!groups[org]) {
                groups[org] = { name: org, budget: 0, realisasi: 0, subkegCount: new Set() };
            }
            groups[org].budget += r.anggaran || 0;
            groups[org].realisasi += r.realisasi || 0;
            if (r.kodeSubkegiatan) {
                groups[org].subkegCount.add(r.kodeSubkegiatan);
            }
        });

        const sorted = Object.values(groups).sort((a, b) => b.budget - a.budget);

        if (countBadge) {
            countBadge.textContent = `${sorted.length} Unit`;
        }

        if (sorted.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4 text-xs">Tidak ada data unit kerja</td></tr>`;
            return;
        }

        tableBody.innerHTML = sorted.map((item, idx) => {
            const pct = totalBudget > 0 ? (item.budget / totalBudget * 100).toFixed(1) : '0.0';
            let shortName = item.name;
            if (shortName.includes('UPT PENGELOLAAN JALAN DAN JEMBATAN')) {
                shortName = shortName.replace('UPT PENGELOLAAN JALAN DAN JEMBATAN', 'UPT PJJ');
            }

            return `
                <tr>
                    <td class="text-secondary text-xxs fw-bold ps-2">${idx + 1}</td>
                    <td>
                        <div class="fw-semibold text-dark text-truncate" style="max-width: 200px;" title="${item.name}">${shortName}</div>
                        <div class="text-muted text-xxs">${item.subkegCount.size} Subkegiatan</div>
                    </td>
                    <td class="text-end fw-bold text-dark text-xs">${formatShortRupiah(item.budget)}</td>
                    <td class="text-end pe-2">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5 text-xxs fw-semibold">${pct}%</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderProgramChart(data) {
        const elCanvas = document.getElementById('chart-program');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.program) {
            state.charts.program.destroy();
        }

        const labels = Object.keys(data);
        const values = Object.values(data);

        // Map long program names to shorter names for chart legend
        const shortLabels = labels.map(p => {
            if (p.includes('Program Penunjang Urusan')) return 'Prog. Penunjang (Urusan Pemda)';
            if (p.length > 25) return p.substring(0, 22) + '...';
            return p;
        });

        const colors = [
            'rgba(59, 130, 246, 0.8)',   // Blue
            'rgba(16, 185, 129, 0.8)',   // Emerald
            'rgba(245, 158, 11, 0.8)',   // Amber
            'rgba(139, 92, 246, 0.8)',   // Purple
            'rgba(6, 182, 212, 0.8)',    // Cyan
            'rgba(236, 72, 153, 0.8)',   // Pink
            'rgba(244, 63, 94, 0.8)',    // Rose
            'rgba(100, 116, 139, 0.8)',  // Slate
            'rgba(20, 184, 166, 0.8)'    // Teal
        ];

        state.charts.program = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: shortLabels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#ffffff',
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '50%',
                onClick: (e) => {
                    showAllProgramDetails();
                },
                onHover: (evt) => {
                    evt.chart.canvas.style.cursor = 'pointer';
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Poppins', size: 9 },
                            boxWidth: 8,
                            padding: 6
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((context.raw / total) * 100).toFixed(1) + '%';
                                const originalLabel = labels[context.dataIndex];
                                return `${originalLabel}: ${formatRupiah(context.raw)} (${pct})`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderSubkegiatanChart(data) {
        const elCanvas = document.getElementById('chart-subkegiatan');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.subkegiatan) {
            state.charts.subkegiatan.destroy();
        }

        const labels = Object.keys(data);
        const values = Object.values(data);

        // Map long subkegiatan names to shorter names for chart legend
        const shortLabels = labels.map(p => {
            if (p.length > 25) return p.substring(0, 22) + '...';
            return p;
        });

        const colors = [
            'rgba(6, 182, 212, 0.8)',    // Cyan
            'rgba(236, 72, 153, 0.8)',   // Pink
            'rgba(59, 130, 246, 0.8)',   // Blue
            'rgba(16, 185, 129, 0.8)',   // Emerald
            'rgba(245, 158, 11, 0.8)',   // Amber
            'rgba(139, 92, 246, 0.8)',   // Purple
            'rgba(244, 63, 94, 0.8)',    // Rose
            'rgba(100, 116, 139, 0.8)',  // Slate
            'rgba(20, 184, 166, 0.8)'    // Teal
        ];

        state.charts.subkegiatan = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: shortLabels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#ffffff',
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '50%',
                onClick: (e) => {
                    showAllSubkegiatanDetails();
                },
                onHover: (evt) => {
                    evt.chart.canvas.style.cursor = 'pointer';
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Poppins', size: 9 },
                            boxWidth: 8,
                            padding: 6
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((context.raw / total) * 100).toFixed(1) + '%';
                                const originalLabel = labels[context.dataIndex];
                                return `${originalLabel}: ${formatRupiah(context.raw)} (${pct})`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 10. Filter Change Event Handlers
    elTahunFilter.addEventListener('change', function () {
        state.activeFilters.tahun = this.value;
        applyFilters();
    });

    elJenisFilter.addEventListener('change', function () {
        state.activeFilters.jenisAnggaran = this.value;
        applyFilters();
    });

    elBidangFilter.addEventListener('change', function () {
        state.activeFilters.bidangUpt = this.value;
        applyFilters();
    });

    elProgramFilter.addEventListener('change', function () {
        state.activeFilters.program = this.value;
        applyFilters();
    });



    const elTopHierarchyFilter = document.getElementById('top-hierarchy-filter');
    if (elTopHierarchyFilter) {
        elTopHierarchyFilter.addEventListener('change', function () {
            renderTopProgramsList();
        });
    }

    // Debounced text search
    let searchTimeout;
    if (elSearchInput) {
        elSearchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.activeFilters.search = this.value;
                applyFilters();
            }, 300);
        });
    }

    // Reset Filters Button
    elBtnReset.addEventListener('click', function () {
        elTahunFilter.value = '2026';
        elJenisFilter.value = 'all';
        elBidangFilter.value = 'all';
        elProgramFilter.value = 'all';
        if (elSearchInput) elSearchInput.value = '';
        
        state.activeFilters = {
            tahun: '2026',
            jenisAnggaran: 'all',
            bidangUpt: 'all',
            program: 'all',
            search: ''
        };
        applyFilters();
    });

    // 11. CSV Export Handler
    elBtnExport.addEventListener('click', function () {
        if (state.filteredData.length === 0) {
            alert('Tidak ada data untuk diekspor!');
            return;
        }

        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "No;Kode Program;Program;Kode Kegiatan;Kegiatan;Kode Subkegiatan;Subkegiatan;Bidang/UPT;Jenis Anggaran;Tahun;Anggaran;Catatan\r\n";

        // CSV Rows
        state.filteredData.forEach(row => {
            const formattedRow = [
                row.no,
                `"${row.kodeProgram}"`,
                `"${row.program.replace(/"/g, '""')}"`,
                `"${row.kodeKegiatan}"`,
                `"${row.kegiatan.replace(/"/g, '""')}"`,
                `"${row.kodeSubkegiatan}"`,
                `"${row.subkegiatan.replace(/"/g, '""')}"`,
                `"${row.bidangUpt.replace(/"/g, '""')}"`,
                `"${row.jenisAnggaran}"`,
                row.tahun,
                row.anggaran,
                `"${(row.catatan || '').replace(/"/g, '""')}"`
            ];
            csvContent += formattedRow.join(";") + "\r\n";
        });

        // Download Trigger
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `Analisa_Anggaran_Filtered_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 12. Performance Mapping Tab Event Listeners
    let mappingSearchTimeout;
    if (elMappingSearch) {
        elMappingSearch.addEventListener('input', function () {
            clearTimeout(mappingSearchTimeout);
            mappingSearchTimeout = setTimeout(() => {
                state.mappingSearch = this.value;
                state.mappingPagination.currentPage = 1;
                renderMappingTab();
            }, 300);
        });
    }

    if (elMappingLimit) {
        elMappingLimit.addEventListener('change', function () {
            state.mappingPagination.limit = this.value;
            state.mappingPagination.currentPage = 1;
            renderMappingTab();
        });
    }

    const chartsTabEl = document.getElementById('charts-tab');
    if (chartsTabEl) {
        chartsTabEl.addEventListener('shown.bs.tab', function () {
            updateCharts();
            if (state.charts.trend) state.charts.trend.resize();
            if (state.charts.jenis) state.charts.jenis.resize();
        });
    }

    const anggaranPaguTabEl = document.getElementById('anggaran-pagu-tab');
    if (anggaranPaguTabEl) {
        anggaranPaguTabEl.addEventListener('shown.bs.tab', function () {
            renderPaguJenisChart();
            renderTable();
            if (state.charts.paguJenis) state.charts.paguJenis.resize();
        });
    }

    const anggaranRealisasiTabEl = document.getElementById('anggaran-realisasi-tab');
    if (anggaranRealisasiTabEl) {
        anggaranRealisasiTabEl.addEventListener('shown.bs.tab', function () {
            renderAnggaranTahunJenisChart();
            renderAnggaranBulanChart();
            renderAnggaranBidangChart();
            renderRealisasiTab();
            if (state.charts.anggaranTahunJenis) state.charts.anggaranTahunJenis.resize();
            if (state.charts.anggaranBulan) state.charts.anggaranBulan.resize();
            if (state.charts.anggaranBidang) state.charts.anggaranBidang.resize();
        });
    }

    const elAnggaranViewMode = document.getElementById('anggaran-view-mode');
    if (elAnggaranViewMode) {
        elAnggaranViewMode.addEventListener('change', function () {
            renderAnggaranTahunJenisChart();
        });
    }

    function renderAnggaranTabCharts() {
        const elDaftarPaguTitle = document.getElementById('title-daftar-pagu-text');
        if (elDaftarPaguTitle) {
            const yearText = state.activeFilters.tahun === 'all' ? '(Semua Tahun)' : `Tahun ${state.activeFilters.tahun}`;
            elDaftarPaguTitle.textContent = `Daftar Pagu Anggaran ${yearText}`;
        }
        renderPaguJenisChart();
        renderAnggaranTahunJenisChart();
        renderAnggaranBulanChart();
        renderAnggaranBidangChart();
        renderRealisasiTab();
    }

    function renderPaguJenisChart() {
        const elCanvas = document.getElementById('chart-pagu-jenis');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.paguJenis) {
            state.charts.paguJenis.destroy();
        }

        const legendContainer = document.getElementById('legend-pagu-jenis');
        const titleEl = document.getElementById('title-pagu-jenis');
        const years = [2021, 2022, 2023, 2024, 2025, 2026];
        const activeYear = state.activeFilters.tahun;

        if (titleEl) {
            const yearText = activeYear === 'all' ? 'Tahun 2021 - 2026' : `Tahun ${activeYear}`;
            titleEl.textContent = `Jenis Pagu Anggaran ${yearText}`;
        }

        function hexToRgba(hex, alpha) {
            if (!hex) return `rgba(100, 116, 139, ${alpha})`;
            if (Array.isArray(hex)) hex = hex[0] || '#4f46e5';
            if (typeof hex !== 'string') return `rgba(100, 116, 139, ${alpha})`;
            if (hex.startsWith('rgba(')) return hex.replace(/[\d\.]+\)$/, `${alpha})`);
            if (hex.startsWith('rgb(')) return hex.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
            let c = hex.replace('#', '').trim();
            if (c.length === 3) c = c.split('').map(x => x + x).join('');
            const num = parseInt(c, 16);
            if (isNaN(num)) return `rgba(100, 116, 139, ${alpha})`;
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        const yearJenisMap = {};
        years.forEach(y => { yearJenisMap[y] = {}; });

        const filteredData = BUDGET_DATA.filter(row => {
            const matchJenis = state.activeFilters.jenisAnggaran === 'all' || row.jenisAnggaran === state.activeFilters.jenisAnggaran;
            const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
            const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
            let matchSearch = true;
            if (state.activeFilters.search && state.activeFilters.search.trim() !== '') {
                const query = state.activeFilters.search.toLowerCase();
                matchSearch = (row.program && row.program.toLowerCase().includes(query)) ||
                              (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                              (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                              (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query));
            }
            return matchJenis && matchBidang && matchProgram && matchSearch;
        });

        const distinctJenisSet = new Set();
        filteredData.forEach(row => {
            if (row.tahun && years.includes(row.tahun) && row.jenisAnggaran) {
                distinctJenisSet.add(row.jenisAnggaran);
                yearJenisMap[row.tahun][row.jenisAnggaran] = (yearJenisMap[row.tahun][row.jenisAnggaran] || 0) + (row.anggaran || 0);
            }
        });

        const desiredOrder = [
            'APBD',
            'P-APBD Pergeseran',
            'P-APBD Mendahului I',
            'P-APBD Mendahului II',
            'P-APBD Mendahului III',
            'P-APBD',
            'P-APBD Mendahului II (PEN)'
        ];

        const distinctJenisList = Array.from(distinctJenisSet).sort((a, b) => {
            let idxA = desiredOrder.indexOf(a);
            let idxB = desiredOrder.indexOf(b);
            if (idxA === -1) idxA = 99;
            if (idxB === -1) idxB = 99;
            return idxA - idxB;
        });

        // Color definitions preserved per budget type, matching Realisasi Pagu Anggaran aesthetic
        const colorMap = {
            'APBD': {
                bg: '#fde047',
                border: '#eab308',
                gradFrom: '#fef08a',
                gradMid: '#facc15',
                gradTo: '#eab308',
                shadow: 'rgba(234, 179, 8, 0.35)',
                text: '#eab308'
            },
            'P-APBD': {
                bg: '#f59e0b',
                border: '#d97706',
                gradFrom: '#fbbf24',
                gradMid: '#f59e0b',
                gradTo: '#d97706',
                shadow: 'rgba(217, 119, 6, 0.35)',
                text: '#b45309'
            },
            'P-APBD Pergeseran': {
                bg: '#3b82f6',
                border: '#2563eb',
                gradFrom: '#93c5fd',
                gradMid: '#3b82f6',
                gradTo: '#1d4ed8',
                shadow: 'rgba(37, 99, 235, 0.35)',
                text: '#1d4ed8'
            },
            'P-APBD Mendahului I': {
                bg: '#a78bfa',
                border: '#8b5cf6',
                gradFrom: '#c4b5fd',
                gradMid: '#a78bfa',
                gradTo: '#7c3aed',
                shadow: 'rgba(139, 92, 246, 0.35)',
                text: '#7c3aed'
            },
            'P-APBD Mendahului II': {
                bg: '#38bdf8',
                border: '#0284c7',
                gradFrom: '#7dd3fc',
                gradMid: '#38bdf8',
                gradTo: '#0284c7',
                shadow: 'rgba(2, 132, 199, 0.35)',
                text: '#0284c7'
            },
            'P-APBD Mendahului III': {
                bg: '#fb7185',
                border: '#e11d48',
                gradFrom: '#fda4af',
                gradMid: '#fb7185',
                gradTo: '#be123c',
                shadow: 'rgba(225, 29, 72, 0.35)',
                text: '#be123c'
            },
            'P-APBD Mendahului II (PEN)': {
                bg: '#94a3b8',
                border: '#64748b',
                gradFrom: '#cbd5e1',
                gradMid: '#94a3b8',
                gradTo: '#475569',
                shadow: 'rgba(100, 116, 139, 0.35)',
                text: '#475569'
            }
        };

        const rawValuesByJenis = {};
        distinctJenisList.forEach(jType => {
            rawValuesByJenis[jType] = years.map(y => yearJenisMap[y][jType] || 0);
        });

        const datasets = distinctJenisList.map(jType => {
            const c = colorMap[jType] || {
                bg: '#fde047',
                border: '#eab308',
                gradFrom: '#fef08a',
                gradMid: '#facc15',
                gradTo: '#eab308',
                shadow: 'rgba(234, 179, 8, 0.35)',
                text: '#eab308'
            };
            const rawVals = rawValuesByJenis[jType];
            return {
                label: jType,
                colorKey: c.border,
                data: rawVals,
                rawValues: rawVals,
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    const idx = context.dataIndex;
                    const y = years[idx];
                    const isYearMatched = (activeYear === 'all') || (y && y.toString() === activeYear);
                    if (!isYearMatched) return hexToRgba(c.bg, 0.28);
                    if (!chartArea) return c.bg;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, c.gradFrom);
                    gradient.addColorStop(0.5, c.gradMid);
                    gradient.addColorStop(1, c.gradTo);
                    return gradient;
                },
                borderWidth: 0,
                borderColor: 'transparent',
                hoverBackgroundColor: c.border,
                borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
                borderSkipped: 'bottom',
                barPercentage: 0.80,
                categoryPercentage: 0.82
            };
        });

        // Update Legend HTML - modern badges matching Realisasi Pagu Anggaran
        if (legendContainer) {
            legendContainer.innerHTML = `
                <div class="d-flex align-items-center justify-content-center gap-4 text-xs flex-wrap">
                    ${distinctJenisList.map(jType => {
                        const c = colorMap[jType] || {
                            gradFrom: '#fef08a',
                            gradTo: '#eab308',
                            shadow: 'rgba(234, 179, 8, 0.35)'
                        };
                        return `
                            <div class="d-flex align-items-center gap-2">
                                <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, ${c.gradFrom} 0%, ${c.gradTo} 100%); border-radius: 3px; box-shadow: 0 2px 5px ${c.shadow};"></span>
                                <span class="text-secondary fw-bold">${jType}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Plugin to render labels on top of bars with clean collision avoidance & white stroke
        const barTopLabelsPlugin = {
            id: 'barTopLabelsPlugin_PaguJenis',
            beforeDatasetsDraw(chart) {
                const xScale = chart.scales.x;
                const numYears = years.length;
                if (!xScale || numYears === 0) return;

                const bandWidth = xScale.width / numYears;
                const catWidth = bandWidth * 0.82;

                for (let catIdx = 0; catIdx < numYears; catIdx++) {
                    const catX = xScale.getPixelForTick(catIdx);
                    const activeItems = [];

                    chart.data.datasets.forEach((dataset, dIdx) => {
                        const rawVal = dataset.rawValues ? dataset.rawValues[catIdx] : dataset.data[catIdx];
                        const meta = chart.getDatasetMeta(dIdx);
                        const element = meta.data[catIdx];
                        if (element) {
                            if (rawVal !== undefined && rawVal !== null && rawVal > 0) {
                                activeItems.push({ element, dIdx, rawVal });
                            } else {
                                element.width = 0;
                            }
                        }
                    });

                    const M = activeItems.length;
                    if (M > 0) {
                        const slotWidth = catWidth / M;
                        const barWidth = Math.min(slotWidth * 0.78, 24);
                        const startX = catX - (catWidth / 2);

                        activeItems.forEach((item, k) => {
                            item.element.x = startX + (k + 0.5) * slotWidth;
                            item.element.width = barWidth;
                        });
                    }
                }
            },
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const numYears = years.length;

                for (let catIdx = 0; catIdx < numYears; catIdx++) {
                    const y = years[catIdx];
                    const isYearMatched = (activeYear === 'all') || (y && y.toString() === activeYear);
                    const barLabels = [];

                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        const element = meta.data[catIdx];
                        if (!element) return;

                        const rawVal = dataset.rawValues ? dataset.rawValues[catIdx] : dataset.data[catIdx];
                        if (rawVal !== undefined && rawVal !== null && rawVal > 0) {
                            const c = colorMap[dataset.label];
                            const labelColor = c ? c.text : (dataset.colorKey || '#4f46e5');
                            const textColor = isYearMatched ? labelColor : hexToRgba(labelColor, 0.35);
                            const valText = formatShortRupiah(rawVal);

                            barLabels.push({
                                x: element.x,
                                baseY: element.y - 4,
                                y: element.y - 4,
                                text: valText,
                                color: textColor,
                                isYearMatched: isYearMatched
                            });
                        }
                    });

                    if (barLabels.length === 0) continue;

                    // Sort left to right
                    barLabels.sort((a, b) => a.x - b.x);

                    // Prevent collision: if horizontal distance < 42px and heights are close (< 14px), stagger Y
                    for (let i = 1; i < barLabels.length; i++) {
                        const prev = barLabels[i - 1];
                        const curr = barLabels[i];
                        if (Math.abs(curr.x - prev.x) < 42 && Math.abs(curr.baseY - prev.baseY) < 14) {
                            if (prev.y === prev.baseY) {
                                curr.y = prev.baseY - 14;
                            } else {
                                curr.y = prev.baseY;
                            }
                        }
                    }

                    // Render labels with white stroke outline
                    barLabels.forEach(lbl => {
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = lbl.isYearMatched ? '700 9px Poppins, sans-serif' : '500 7.5px Poppins, sans-serif';
                        ctx.strokeStyle = lbl.isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
                        ctx.lineWidth = lbl.isYearMatched ? 3.5 : 1.5;
                        ctx.lineJoin = 'round';
                        ctx.strokeText(lbl.text, lbl.x, lbl.y);
                        ctx.fillStyle = lbl.color;
                        ctx.fillText(lbl.text, lbl.x, lbl.y);
                        ctx.restore();
                    });
                }
            }
        };

        state.charts.paguJenis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years.map(y => y.toString()),
                datasets: datasets
            },
            plugins: [barTopLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 42,
                        bottom: 12,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const raw = context.dataset.rawValues ? context.dataset.rawValues[context.dataIndex] : context.raw;
                                return ' ' + context.dataset.label + ': ' + formatRupiah(raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: function(context) {
                                const val = context.tick ? context.tick.label : '';
                                const isMatched = activeYear !== 'all' && val === activeYear;
                                return {
                                    family: 'Poppins',
                                    size: 13,
                                    weight: isMatched ? '800' : '600'
                                };
                            },
                            color: function(context) {
                                const val = context.tick ? context.tick.label : '';
                                if (activeYear === 'all') return '#334155';
                                return val === activeYear ? '#0f172a' : '#94a3b8';
                            },
                            padding: 4
                        }
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        grace: '85%',
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function formatBidangLabel(name) {
        if (!name) return '';
        if (name === 'Bidang Pembangunan dan Peningkatan') return ['Bidang Pembangunan', '& Peningkatan'];
        if (name === 'Bidang Pengaturan dan Pengendalian') return ['Bidang Pengaturan', '& Pengendalian'];
        if (name === 'UPT Laboratorium Pengujian Konstruksi') return ['UPT Lab Uji', 'Konstruksi'];
        if (name.startsWith('UPT PJJ ')) return ['UPT PJJ', name.replace('UPT PJJ ', '')];
        if (name.startsWith('Bidang ')) return ['Bidang', name.replace('Bidang ', '')];
        return name;
    }

    function renderAnggaranTahunJenisChart() {
        const elCanvas = document.getElementById('chart-anggaran-tahun-jenis');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.anggaranTahunJenis) {
            state.charts.anggaranTahunJenis.destroy();
        }

        const elMode = document.getElementById('anggaran-view-mode');
        const mode = elMode ? elMode.value : 'tahun';
        const legendContainer = document.getElementById('legend-anggaran-tahun-jenis');
        const titleEl = document.getElementById('title-anggaran-tahun-jenis');
        const years = [2021, 2022, 2023, 2024, 2025, 2026];
        const activeYear = state.activeFilters.tahun;

        function hexToRgba(hex, alpha) {
            if (!hex) return `rgba(100, 116, 139, ${alpha})`;
            if (Array.isArray(hex)) hex = hex[0] || '#4f46e5';
            if (typeof hex !== 'string') return `rgba(100, 116, 139, ${alpha})`;
            if (hex.startsWith('rgba(')) return hex.replace(/[\d\.]+\)$/, `${alpha})`);
            if (hex.startsWith('rgb(')) return hex.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
            let c = hex.replace('#', '').trim();
            if (c.length === 3) c = c.split('').map(x => x + x).join('');
            const num = parseInt(c, 16);
            if (isNaN(num)) return `rgba(100, 116, 139, ${alpha})`;
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        // Plugin to render labels on top of bars & line points
        const barTopValueLabelsPlugin = {
            id: 'barTopValueLabelsPlugin',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const numYears = years.length;

                for (let catIdx = 0; catIdx < numYears; catIdx++) {
                    const y = years[catIdx];
                    const isYearMatched = (activeYear === 'all') || (y && y.toString() === activeYear);
                    const barLabelsInCat = [];
                    let lineLabelItem = null;

                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        const element = meta.data[catIdx];
                        if (!element) return;

                        const val = dataset.data[catIdx];
                        if (val !== undefined && val !== null && !isNaN(val)) {
                            if (dataset.type === 'line' || (dataset.label && dataset.label.includes('Capaian'))) {
                                const valText = val.toFixed(1).replace('.', ',') + '%';
                                lineLabelItem = {
                                    x: element.x,
                                    y: element.y - (isYearMatched && activeYear !== 'all' ? 9 : 7),
                                    text: valText,
                                    isYearMatched: isYearMatched
                                };
                            } else if (val > 0) {
                                let textColor;
                                if (dataset.label && dataset.label.includes('(APBD)')) {
                                    textColor = isYearMatched ? '#a16207' : 'rgba(161, 98, 7, 0.32)';
                                } else if (dataset.label && (dataset.label.includes('P-APBD') || dataset.label.includes('Anggaran'))) {
                                    textColor = isYearMatched ? '#b45309' : 'rgba(180, 83, 9, 0.32)';
                                } else if (dataset.label && dataset.label.includes('Realisasi')) {
                                    textColor = isYearMatched ? '#047857' : 'rgba(4, 120, 87, 0.32)';
                                } else {
                                    const bColor = dataset.colorKey || (typeof dataset.borderColor === 'string' ? dataset.borderColor : '#4f46e5');
                                    textColor = isYearMatched ? bColor : hexToRgba(bColor, 0.32);
                                }
                                const rawVal = dataset.rawValues ? dataset.rawValues[catIdx] : val;
                                const valText = formatShortRupiah(rawVal);

                                ctx.save();
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                ctx.font = isYearMatched ? '700 8.5px Poppins, sans-serif' : '500 7.5px Poppins, sans-serif';
                                ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                ctx.lineJoin = 'round';
                                ctx.strokeText(valText, element.x, element.y - 5);
                                ctx.fillStyle = textColor;
                                ctx.fillText(valText, element.x, element.y - 5);
                                ctx.restore();
                            }
                        }
                    });

                    // Render line label (if any)
                    if (lineLabelItem) {
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = lineLabelItem.isYearMatched ? '800 11px Poppins, sans-serif' : '500 8.5px Poppins, sans-serif';
                        ctx.strokeStyle = lineLabelItem.isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                        ctx.lineWidth = lineLabelItem.isYearMatched ? 3 : 1.5;
                        ctx.lineJoin = 'round';
                        ctx.strokeText(lineLabelItem.text, lineLabelItem.x, lineLabelItem.y);
                        ctx.fillStyle = lineLabelItem.isYearMatched ? '#1d4ed8' : 'rgba(29, 78, 216, 0.32)';
                        ctx.fillText(lineLabelItem.text, lineLabelItem.x, lineLabelItem.y);
                        ctx.restore();
                    }
                }
            }
        };

        if (mode === 'jenis') {
            if (titleEl) {
                const yearText = activeYear === 'all' ? '(Semua Tahun)' : `Tahun ${activeYear}`;
                titleEl.textContent = `Jenis Pagu Anggaran ${yearText}`;
            }
            // Mode Per Jenis Anggaran: Breakdown per year (2021-2026) on X-axis, per jenisAnggaran dataset
            const yearJenisMap = {};
            years.forEach(y => { yearJenisMap[y] = {}; });

            const filteredData = BUDGET_DATA.filter(row => {
                const matchJenis = state.activeFilters.jenisAnggaran === 'all' || row.jenisAnggaran === state.activeFilters.jenisAnggaran;
                const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
                const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
                let matchSearch = true;
                if (state.activeFilters.search.trim() !== '') {
                    const query = state.activeFilters.search.toLowerCase();
                    matchSearch = (row.program && row.program.toLowerCase().includes(query)) ||
                                  (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                                  (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                                  (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query));
                }
                return matchJenis && matchBidang && matchProgram && matchSearch;
            });

            const distinctJenisSet = new Set();
            filteredData.forEach(row => {
                if (row.tahun && years.includes(row.tahun) && row.jenisAnggaran) {
                    distinctJenisSet.add(row.jenisAnggaran);
                    yearJenisMap[row.tahun][row.jenisAnggaran] = (yearJenisMap[row.tahun][row.jenisAnggaran] || 0) + (row.anggaran || 0);
                }
            });

            const desiredOrder = [
                'APBD',
                'P-APBD Pergeseran',
                'P-APBD Mendahului I',
                'P-APBD Mendahului II',
                'P-APBD Mendahului III',
                'P-APBD',
                'P-APBD Mendahului II (PEN)'
            ];

            const distinctJenisList = Array.from(distinctJenisSet).sort((a, b) => {
                let idxA = desiredOrder.indexOf(a);
                let idxB = desiredOrder.indexOf(b);
                if (idxA === -1) idxA = 99;
                if (idxB === -1) idxB = 99;
                return idxA - idxB;
            });

            const colorMap = {
                'APBD': {
                    bg: '#fde047',
                    border: '#eab308',
                    gradFrom: '#fef08a',
                    gradMid: '#facc15',
                    gradTo: '#eab308',
                    shadow: 'rgba(234, 179, 8, 0.35)',
                    text: '#eab308'
                },
                'P-APBD': {
                    bg: '#f59e0b',
                    border: '#d97706',
                    gradFrom: '#fbbf24',
                    gradMid: '#f59e0b',
                    gradTo: '#d97706',
                    shadow: 'rgba(217, 119, 6, 0.35)',
                    text: '#b45309'
                },
                'P-APBD Pergeseran': {
                    bg: '#3b82f6',
                    border: '#2563eb',
                    gradFrom: '#93c5fd',
                    gradMid: '#3b82f6',
                    gradTo: '#1d4ed8',
                    shadow: 'rgba(37, 99, 235, 0.35)',
                    text: '#1d4ed8'
                },
                'P-APBD Mendahului I': {
                    bg: '#a78bfa',
                    border: '#8b5cf6',
                    gradFrom: '#c4b5fd',
                    gradMid: '#a78bfa',
                    gradTo: '#7c3aed',
                    shadow: 'rgba(139, 92, 246, 0.35)',
                    text: '#7c3aed'
                },
                'P-APBD Mendahului II': {
                    bg: '#38bdf8',
                    border: '#0284c7',
                    gradFrom: '#7dd3fc',
                    gradMid: '#38bdf8',
                    gradTo: '#0284c7',
                    shadow: 'rgba(2, 132, 199, 0.35)',
                    text: '#0284c7'
                },
                'P-APBD Mendahului III': {
                    bg: '#fb7185',
                    border: '#e11d48',
                    gradFrom: '#fda4af',
                    gradMid: '#fb7185',
                    gradTo: '#be123c',
                    shadow: 'rgba(225, 29, 72, 0.35)',
                    text: '#be123c'
                },
                'P-APBD Mendahului II (PEN)': {
                    bg: '#94a3b8',
                    border: '#64748b',
                    gradFrom: '#cbd5e1',
                    gradMid: '#94a3b8',
                    gradTo: '#475569',
                    shadow: 'rgba(100, 116, 139, 0.35)',
                    text: '#475569'
                }
            };

            const rawValuesByJenis = {};
            distinctJenisList.forEach(jType => {
                rawValuesByJenis[jType] = years.map(y => yearJenisMap[y][jType] || 0);
            });

            const datasets = distinctJenisList.map(jType => {
                const c = colorMap[jType] || {
                    bg: '#fde047',
                    border: '#eab308',
                    gradFrom: '#fef08a',
                    gradMid: '#facc15',
                    gradTo: '#eab308',
                    shadow: 'rgba(234, 179, 8, 0.35)',
                    text: '#eab308'
                };
                const rawVals = rawValuesByJenis[jType];
                return {
                    label: jType,
                    colorKey: c.border,
                    data: rawVals,
                    rawValues: rawVals,
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        const idx = context.dataIndex;
                        const y = years[idx];
                        const isYearMatched = (activeYear === 'all') || (y && y.toString() === activeYear);
                        if (!isYearMatched) return hexToRgba(c.bg, 0.28);
                        if (!chartArea) return c.bg;
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, c.gradFrom);
                        gradient.addColorStop(0.5, c.gradMid);
                        gradient.addColorStop(1, c.gradTo);
                        return gradient;
                    },
                    borderWidth: 0,
                    borderColor: 'transparent',
                    hoverBackgroundColor: c.border,
                    borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: 'bottom',
                    barPercentage: 0.80,
                    categoryPercentage: 0.82
                };
            });

            // Update Legend HTML - modern badges matching Realisasi Pagu Anggaran
            if (legendContainer) {
                legendContainer.innerHTML = `
                    <div class="d-flex align-items-center justify-content-center gap-4 text-xs flex-wrap">
                        ${distinctJenisList.map(jType => {
                            const c = colorMap[jType] || {
                                gradFrom: '#fef08a',
                                gradTo: '#eab308',
                                shadow: 'rgba(234, 179, 8, 0.35)'
                            };
                            return `
                                <div class="d-flex align-items-center gap-2">
                                    <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, ${c.gradFrom} 0%, ${c.gradTo} 100%); border-radius: 3px; box-shadow: 0 2px 5px ${c.shadow};"></span>
                                    <span class="text-secondary fw-bold">${jType}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }

            state.charts.anggaranTahunJenis = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: years.map(y => y.toString()),
                    datasets: datasets
                },
                plugins: [barTopValueLabelsPlugin],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 45,
                            bottom: 5,
                            left: 10,
                            right: 10
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const raw = context.dataset.rawValues ? context.dataset.rawValues[context.dataIndex] : context.raw;
                                    return context.dataset.label + ': ' + formatRupiah(raw);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: function(context) {
                                    const val = context.tick ? context.tick.label : '';
                                    const isMatched = activeYear !== 'all' && val === activeYear;
                                    return {
                                        family: 'Poppins',
                                        size: 11,
                                        weight: isMatched ? '800' : '600'
                                    };
                                },
                                color: function(context) {
                                    const val = context.tick ? context.tick.label : '';
                                    if (activeYear === 'all') return '#334155';
                                    return val === activeYear ? '#0f172a' : '#94a3b8';
                                }
                            }
                        },
                        y: {
                            display: false,
                            beginAtZero: true,
                            grace: '45%',
                            grid: { display: false }
                        }
                    }
                }
            });

        } else {
            if (titleEl) {
                const yearText = activeYear === 'all' ? 'Tahun 2021 - 2026' : `Tahun ${activeYear}`;
                titleEl.textContent = `Realisasi Pagu Anggaran ${yearText}`;
            }
            // Mode Per Tahun: Years 2021-2026 grouped by APBD Murni, P-APBD, Realisasi, and Capaian (%)
            const years = [2021, 2022, 2023, 2024, 2025, 2026];
            const apbdMurniValues = [0, 0, 0, 0, 0, 0];
            const papbdValues = [0, 0, 0, 0, 0, 0];
            const realisasiValues = [0, 0, 0, 0, 0, 0];

            const filteredData = BUDGET_DATA.filter(row => {
                const matchJenis = state.activeFilters.jenisAnggaran === 'all' || row.jenisAnggaran === state.activeFilters.jenisAnggaran;
                const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
                const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
                let matchSearch = true;
                if (state.activeFilters.search.trim() !== '') {
                    const query = state.activeFilters.search.toLowerCase();
                    matchSearch = (row.program && row.program.toLowerCase().includes(query)) ||
                                  (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                                  (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                                  (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query)) ||
                                  (row.kodeSubkegiatan && row.kodeSubkegiatan.toLowerCase().includes(query)) ||
                                  (row.catatan && row.catatan.toLowerCase().includes(query));
                }
                return matchJenis && matchBidang && matchProgram && matchSearch;
            });

            filteredData.forEach(row => {
                const idx = years.indexOf(row.tahun);
                if (idx !== -1) {
                    if (row.jenisAnggaran === 'APBD') {
                        apbdMurniValues[idx] += row.anggaran || 0;
                    }
                    if (row.jenisAnggaran === 'P-APBD') {
                        papbdValues[idx] += row.anggaran || 0;
                    }
                    if (isRowInActiveSummaryScope(row)) {
                        realisasiValues[idx] += row.realisasi || 0;
                    }
                }
            });

            const capaianValues = years.map((y, idx) => {
                const ang = papbdValues[idx] > 0 ? papbdValues[idx] : apbdMurniValues[idx];
                const rel = realisasiValues[idx] || 0;
                return ang > 0 && rel > 0 ? parseFloat((rel / ang * 100).toFixed(2)) : null;
            });

            // Update Legend - APBD Murni (Kuning), P-APBD (Orange/Amber), Realisasi (Hijau), Capaian (Biru)
            if (legendContainer) {
                legendContainer.innerHTML = `
                    <div class="d-flex align-items-center justify-content-center gap-4 text-xs flex-wrap">
                        <div class="d-flex align-items-center gap-2">
                            <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #fef08a 0%, #eab308 100%); border-radius: 3px; box-shadow: 0 2px 5px rgba(234, 179, 8, 0.35);"></span>
                            <span class="text-secondary fw-bold">APBD Murni</span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); border-radius: 3px; box-shadow: 0 2px 5px rgba(217, 119, 6, 0.35);"></span>
                            <span class="text-secondary fw-bold">P-APBD</span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #34d399 0%, #059669 100%); border-radius: 3px; box-shadow: 0 2px 5px rgba(5, 150, 105, 0.35);"></span>
                            <span class="text-secondary fw-bold">Realisasi</span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 14px; position: relative;">
                                <span style="position: absolute; width: 100%; height: 3px; background-color: #2563eb; border-radius: 2px;"></span>
                                <span style="position: relative; width: 8px; height: 8px; background-color: #ffffff; border: 2.5px solid #2563eb; border-radius: 50%; z-index: 1; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.4);"></span>
                            </span>
                            <span class="text-secondary fw-bold">Capaian</span>
                        </div>
                    </div>
                `;
            }

            // Custom plugin for rendering value labels on top of bars & line points
            const realisasiTahunLabelsPlugin = {
                id: 'realisasiTahunLabelsPlugin',
                afterDatasetsDraw(chart) {
                    const { ctx } = chart;
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((element, index) => {
                            const val = dataset.data[index];
                            if (val !== undefined && val !== null && !isNaN(val)) {
                                const lbl = years[index];
                                const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);

                                ctx.save();
                                ctx.textAlign = 'center';

                                if (dataset.type === 'line' || (dataset.label && dataset.label.includes('Capaian'))) {
                                    // Capaian (Line): Persentase di atas marker point jika ada realisasi
                                    if (val !== null && val !== undefined && val > 0) {
                                        ctx.font = isYearMatched ? '800 11.5px Poppins, sans-serif' : '500 8.5px Poppins, sans-serif';
                                        ctx.fillStyle = isYearMatched ? '#1d4ed8' : 'rgba(29, 78, 216, 0.32)';
                                        ctx.textBaseline = 'bottom';
                                        ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                        ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                        ctx.lineJoin = 'round';
                                        const valText = val.toFixed(1).replace('.', ',') + '%';
                                        ctx.strokeText(valText, element.x, element.y - (isYearMatched && activeYear !== 'all' ? 9 : 7));
                                        ctx.fillText(valText, element.x, element.y - (isYearMatched && activeYear !== 'all' ? 9 : 7));
                                    }
                                } else if (dataset.label === 'APBD Murni') {
                                    // APBD Murni (Bar): Format short Rupiah berwarna kuning dengan garis tepi putih (white stroke)
                                    if (val > 0) {
                                        ctx.font = isYearMatched ? '700 9.5px Poppins, sans-serif' : '500 7.5px Poppins, sans-serif';
                                        ctx.fillStyle = isYearMatched ? '#eab308' : 'rgba(234, 179, 8, 0.35)';
                                        ctx.textBaseline = 'bottom';
                                        ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
                                        ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                        ctx.lineJoin = 'round';
                                        const valText = formatShortRupiah(val);
                                        ctx.strokeText(valText, element.x, element.y - 4);
                                        ctx.fillText(valText, element.x, element.y - 4);
                                    }
                                } else if (dataset.label === 'P-APBD' || dataset.label === 'Anggaran') {
                                    // P-APBD (Bar): Format short Rupiah berwarna amber/orange dengan garis tepi putih
                                    if (val > 0) {
                                        ctx.font = isYearMatched ? '700 9.5px Poppins, sans-serif' : '500 7.5px Poppins, sans-serif';
                                        ctx.fillStyle = isYearMatched ? '#b45309' : 'rgba(180, 83, 9, 0.32)';
                                        ctx.textBaseline = 'bottom';
                                        ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                        ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                        ctx.lineJoin = 'round';
                                        const valText = formatShortRupiah(val);
                                        ctx.strokeText(valText, element.x, element.y - 4);
                                        ctx.fillText(valText, element.x, element.y - 4);
                                    }
                                } else if (dataset.label === 'Realisasi') {
                                    // Realisasi (Bar): Format short Rupiah berwarna hijau dengan garis tepi putih
                                    if (val > 0) {
                                        ctx.font = isYearMatched ? '700 9.5px Poppins, sans-serif' : '500 7.5px Poppins, sans-serif';
                                        ctx.fillStyle = isYearMatched ? '#059669' : 'rgba(5, 150, 105, 0.32)';
                                        ctx.textBaseline = 'bottom';
                                        ctx.strokeStyle = isYearMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                        ctx.lineWidth = isYearMatched ? 3 : 1.5;
                                        ctx.lineJoin = 'round';
                                        const valText = formatShortRupiah(val);
                                        ctx.strokeText(valText, element.x, element.y - 4);
                                        ctx.fillText(valText, element.x, element.y - 4);
                                    }
                                }
                                ctx.restore();
                            }
                        });
                    });
                }
            };

            state.charts.anggaranTahunJenis = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: years.map(y => y.toString()),
                    datasets: [
                        {
                            type: 'line',
                            label: 'Capaian',
                            data: capaianValues,
                            yAxisID: 'y1',
                            borderColor: activeYear === 'all' ? '#2563eb' : 'rgba(37, 99, 235, 0.65)',
                            borderWidth: 2.5,
                            backgroundColor: '#ffffff',
                            spanGaps: false,
                            pointRadius: years.map((l, idx) => {
                                if (capaianValues[idx] === null || capaianValues[idx] === undefined) return 0;
                                return (activeYear !== 'all' && l.toString() === activeYear) ? 7.5 : (activeYear === 'all' ? 5.5 : 4);
                            }),
                            pointHoverRadius: years.map((l, idx) => (capaianValues[idx] === null || capaianValues[idx] === undefined ? 0 : 8)),
                            pointBackgroundColor: years.map(l => (activeYear !== 'all' && l.toString() === activeYear) ? '#2563eb' : '#ffffff'),
                            pointBorderColor: years.map(l => (activeYear !== 'all' && l.toString() === activeYear) ? '#ffffff' : (activeYear === 'all' ? '#2563eb' : 'rgba(37, 99, 235, 0.35)')),
                            pointBorderWidth: years.map(l => (activeYear !== 'all' && l.toString() === activeYear) ? 3.5 : 2.5),
                            pointHoverBorderWidth: 3,
                            tension: 0.25,
                            fill: false,
                            order: 1
                        },
                        {
                            type: 'bar',
                            label: 'APBD Murni',
                            data: apbdMurniValues,
                            yAxisID: 'y',
                            backgroundColor: function(context) {
                                const chart = context.chart;
                                const { ctx, chartArea } = chart;
                                const idx = context.dataIndex;
                                const lbl = years[idx];
                                const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);
                                if (!isYearMatched) return 'rgba(250, 204, 21, 0.28)';
                                if (!chartArea) return '#facc15';
                                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                gradient.addColorStop(0, '#fef08a');
                                gradient.addColorStop(0.5, '#facc15');
                                gradient.addColorStop(1, '#eab308');
                                return gradient;
                            },
                            borderWidth: 0,
                            borderColor: 'transparent',
                            hoverBackgroundColor: '#eab308',
                            borderRadius: {
                                topLeft: 6,
                                topRight: 6,
                                bottomLeft: 0,
                                bottomRight: 0
                            },
                            borderSkipped: 'bottom',
                            barPercentage: 0.80,
                            categoryPercentage: 0.78,
                            order: 2
                        },
                        {
                            type: 'bar',
                            label: 'P-APBD',
                            data: papbdValues,
                            yAxisID: 'y',
                            backgroundColor: function(context) {
                                const chart = context.chart;
                                const { ctx, chartArea } = chart;
                                const idx = context.dataIndex;
                                const lbl = years[idx];
                                const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);
                                if (!isYearMatched) return 'rgba(245, 158, 11, 0.28)';
                                if (!chartArea) return '#f59e0b';
                                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                gradient.addColorStop(0, '#fbbf24');
                                gradient.addColorStop(0.5, '#f59e0b');
                                gradient.addColorStop(1, '#d97706');
                                return gradient;
                            },
                            borderWidth: 0,
                            borderColor: 'transparent',
                            hoverBackgroundColor: '#d97706',
                            borderRadius: {
                                topLeft: 6,
                                topRight: 6,
                                bottomLeft: 0,
                                bottomRight: 0
                            },
                            borderSkipped: 'bottom',
                            barPercentage: 0.80,
                            categoryPercentage: 0.78,
                            order: 3
                        },
                        {
                            type: 'bar',
                            label: 'Realisasi',
                            data: realisasiValues,
                            yAxisID: 'y',
                            backgroundColor: function(context) {
                                const chart = context.chart;
                                const { ctx, chartArea } = chart;
                                const idx = context.dataIndex;
                                const lbl = years[idx];
                                const isYearMatched = (activeYear === 'all') || (lbl && lbl.toString() === activeYear);
                                if (!isYearMatched) return 'rgba(16, 185, 129, 0.28)';
                                if (!chartArea) return '#10b981';
                                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                gradient.addColorStop(0, '#34d399');
                                gradient.addColorStop(0.5, '#10b981');
                                gradient.addColorStop(1, '#059669');
                                return gradient;
                            },
                            borderWidth: 0,
                            borderColor: 'transparent',
                            hoverBackgroundColor: '#059669',
                            borderRadius: {
                                topLeft: 6,
                                topRight: 6,
                                bottomLeft: 0,
                                bottomRight: 0
                            },
                            borderSkipped: 'bottom',
                            barPercentage: 0.80,
                            categoryPercentage: 0.78,
                            order: 4
                        }
                    ]
                },
                plugins: [realisasiTahunLabelsPlugin],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 40,
                            bottom: 15,
                            left: 10,
                            right: 10
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw;
                                    if (context.dataset.type === 'line' || (context.dataset.label && context.dataset.label.includes('Capaian'))) {
                                        if (val === null || val === undefined) {
                                            return ` ${context.dataset.label}: Belum ada realisasi`;
                                        }
                                        return ` ${context.dataset.label}: ${val.toFixed(2).replace('.', ',')}%`;
                                    }
                                    if (val === null || val === undefined) return ` ${context.dataset.label}: -`;
                                    return ` ${context.dataset.label}: ${formatRupiah(val)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            display: false,
                            beginAtZero: true,
                            grace: '90%',
                            grid: { display: false }
                        },
                        y1: {
                            display: false,
                            position: 'right',
                            min: 0,
                            max: 110,
                            grid: { display: false }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: function(context) {
                                    const val = context.tick ? context.tick.label : '';
                                    const isMatched = activeYear !== 'all' && val === activeYear;
                                    return {
                                        family: 'Poppins',
                                        size: 13,
                                        weight: isMatched ? '800' : '600'
                                    };
                                },
                                color: function(context) {
                                    const val = context.tick ? context.tick.label : '';
                                    if (activeYear === 'all') return '#334155';
                                    return val === activeYear ? '#0f172a' : '#94a3b8';
                                },
                                padding: 4
                            }
                        }
                    }
                }
            });
        }
    }

    function renderAnggaranBulanChart() {
        const elCanvas = document.getElementById('chart-anggaran-bulan');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.anggaranBulan) {
            state.charts.anggaranBulan.destroy();
        }

        const titleEl = document.getElementById('title-anggaran-bulan');
        if (titleEl) {
            const yearText = state.activeFilters.tahun === 'all' ? '(Semua Tahun)' : `Tahun ${state.activeFilters.tahun}`;
            titleEl.textContent = `Realisasi Pagu Anggaran per bulan pada ${yearText}`;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        const apbdValues = new Array(12).fill(0);
        const papbdValues = new Array(12).fill(0);
        const realisasiValues = new Array(12).fill(0);

        // Filter by active filters (tahun, jenisAnggaran, bidangUpt, program, search)
        const matchYear = (row) => {
            if (state.activeFilters.tahun === 'all') return true;
            return row.tahun && row.tahun.toString() === state.activeFilters.tahun;
        };
        const matchBidang = (row) => {
            if (state.activeFilters.bidangUpt === 'all') return true;
            return row.bidangUpt === state.activeFilters.bidangUpt;
        };
        const matchProgram = (row) => {
            if (state.activeFilters.program === 'all') return true;
            return row.program === state.activeFilters.program;
        };
        const matchSearch = (row) => {
            if (!state.activeFilters.search || state.activeFilters.search.trim() === '') return true;
            const query = state.activeFilters.search.toLowerCase();
            return (row.program && row.program.toLowerCase().includes(query)) ||
                   (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                   (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                   (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query));
        };

        let hasMonthData = false;
        BUDGET_DATA.forEach(row => {
            if (matchYear(row) && matchBidang(row) && matchProgram(row) && matchSearch(row)) {
                if (row.bulan !== undefined && row.bulan !== null && row.bulan !== '') {
                    hasMonthData = true;
                    let mIdx = -1;
                    if (typeof row.bulan === 'number') {
                        mIdx = row.bulan - 1;
                    } else if (typeof row.bulan === 'string') {
                        const bLower = row.bulan.toLowerCase().trim();
                        const monthMap = {
                            'januari': 0, 'jan': 0, 'februari': 1, 'feb': 1, 'maret': 2, 'mar': 2,
                            'april': 3, 'apr': 3, 'mei': 4, 'juni': 5, 'jun': 5,
                            'juli': 6, 'jul': 6, 'agustus': 7, 'ags': 7, 'agt': 7,
                            'september': 8, 'sep': 8, 'oktober': 9, 'okt': 9,
                            'november': 10, 'nov': 10, 'desember': 11, 'des': 11
                        };
                        mIdx = monthMap[bLower] !== undefined ? monthMap[bLower] : (parseInt(row.bulan, 10) - 1);
                    }
                    if (mIdx >= 0 && mIdx < 12) {
                        if (state.activeFilters.jenisAnggaran === 'all') {
                            if (row.jenisAnggaran === 'APBD') {
                                apbdValues[mIdx] += (row.anggaran || 0);
                            }
                            if (row.jenisAnggaran === 'P-APBD') {
                                papbdValues[mIdx] += (row.anggaran || 0);
                                realisasiValues[mIdx] += (row.realisasi || 0);
                            }
                        } else if (state.activeFilters.jenisAnggaran === 'APBD') {
                            if (row.jenisAnggaran === 'APBD') {
                                apbdValues[mIdx] += (row.anggaran || 0);
                            }
                        } else if (row.jenisAnggaran === state.activeFilters.jenisAnggaran) {
                            papbdValues[mIdx] += (row.anggaran || 0);
                            realisasiValues[mIdx] += (row.realisasi || 0);
                        }
                    }
                }
            }
        });

        const overlayEl = document.getElementById('anggaran-bulan-empty-overlay');
        if (overlayEl) {
            overlayEl.style.display = hasMonthData ? 'none' : 'block';
        }

        const capaians = months.map((m, idx) => {
            const ang = papbdValues[idx] || 0;
            const rel = realisasiValues[idx] || 0;
            return ang > 0 && rel > 0 ? parseFloat((rel / ang * 100).toFixed(2)) : null;
        });

        const bulanBarLabelsPlugin = {
            id: 'bulanBarLabelsPlugin',
            afterDatasetsDraw(chart) {
                if (!hasMonthData) return;
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const val = dataset.data[index];
                        if (val !== undefined && val !== null && !isNaN(val)) {
                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';

                            if (dataset.type === 'line' || (dataset.label && dataset.label.includes('Capaian'))) {
                                ctx.font = '800 10.5px Poppins, sans-serif';
                                ctx.strokeStyle = '#ffffff';
                                ctx.lineWidth = 3;
                                ctx.lineJoin = 'round';
                                const valText = val.toFixed(1).replace('.', ',') + '%';
                                ctx.strokeText(valText, element.x, element.y - 7);
                                ctx.fillStyle = '#1d4ed8';
                                ctx.fillText(valText, element.x, element.y - 7);
                            } else if (val > 0) {
                                ctx.font = '700 8.5px Poppins, sans-serif';
                                ctx.strokeStyle = '#ffffff';
                                ctx.lineWidth = 3;
                                ctx.lineJoin = 'round';

                                let textColor = '#334155';
                                if (dataset.label && dataset.label.includes('(APBD)')) textColor = '#a16207';
                                else if (dataset.label && dataset.label.includes('P-APBD')) textColor = '#b45309';
                                else if (dataset.label && dataset.label.includes('Realisasi')) textColor = '#047857';

                                const valText = formatShortRupiah(val);
                                ctx.strokeText(valText, element.x, element.y - 4);
                                ctx.fillStyle = textColor;
                                ctx.fillText(valText, element.x, element.y - 4);
                            }
                            ctx.restore();
                        }
                    });
                });
            }
        };

        state.charts.anggaranBulan = new Chart(ctx, {
            data: {
                labels: months,
                datasets: [
                    {
                        type: 'line',
                        label: 'Capaian terhadap P-APBD',
                        data: capaians,
                        borderColor: '#2563eb',
                        borderWidth: 2.2,
                        backgroundColor: '#ffffff',
                        pointRadius: 4.5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#2563eb',
                        pointBorderWidth: 2.2,
                        pointHoverBorderWidth: 3,
                        tension: 0.25,
                        fill: false,
                        yAxisID: 'y1',
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Anggaran (APBD)',
                        data: apbdValues,
                        backgroundColor: '#fde047',
                        borderColor: '#eab308',
                        hoverBackgroundColor: '#facc15',
                        borderWidth: 1,
                        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                        barPercentage: 0.78,
                        categoryPercentage: 0.70,
                        maxBarThickness: 24,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'bar',
                        label: 'Anggaran (P-APBD)',
                        data: papbdValues,
                        backgroundColor: '#f59e0b',
                        borderColor: '#d97706',
                        hoverBackgroundColor: '#d97706',
                        borderWidth: 1,
                        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                        barPercentage: 0.78,
                        categoryPercentage: 0.70,
                        maxBarThickness: 24,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'bar',
                        label: 'Realisasi',
                        data: realisasiValues,
                        backgroundColor: '#10b981',
                        borderColor: '#047857',
                        hoverBackgroundColor: '#059669',
                        borderWidth: 1,
                        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                        barPercentage: 0.78,
                        categoryPercentage: 0.70,
                        maxBarThickness: 24,
                        yAxisID: 'y',
                        order: 2
                    }
                ]
            },
            plugins: [bulanBarLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 36,
                        bottom: 5,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.type === 'line' || context.dataset.label.includes('Capaian')) {
                                    return ' ' + context.dataset.label + ': ' + (context.raw !== null ? context.raw.toFixed(2).replace('.', ',') + '%' : '-');
                                }
                                return ' ' + context.dataset.label + ': ' + formatRupiah(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Poppins', size: 11, weight: '600' },
                            color: '#334155'
                        }
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        grace: '75%',
                        grid: { display: false }
                    },
                    y1: {
                        display: false,
                        position: 'right',
                        min: 0,
                        max: 112,
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function renderAnggaranBidangChart() {
        const elCanvas = document.getElementById('chart-anggaran-bidang');
        if (!elCanvas) return;
        const ctx = elCanvas.getContext('2d');
        if (state.charts.anggaranBidang) {
            state.charts.anggaranBidang.destroy();
        }

        const activeBidang = state.activeFilters.bidangUpt;

        // Update Title with Active Year Filter (consistent with Realisasi Pagu Anggaran)
        const titleEl = document.getElementById('title-anggaran-bidang');
        if (titleEl) {
            const yrText = state.activeFilters.tahun === 'all' ? 'Tahun 2021 - 2026' : `Tahun ${state.activeFilters.tahun}`;
            titleEl.textContent = `Realisasi Pagu Anggaran per Bidang / UPT ${yrText}`;
        }

        const bidangMap = {};
        
        // Filter by active filters (tahun, jenisAnggaran, bidangUpt, program, search)
        const matchYear = (row) => {
            if (state.activeFilters.tahun === 'all') return true;
            return row.tahun.toString() === state.activeFilters.tahun;
        };
        const matchBidang = (row) => {
            if (state.activeFilters.bidangUpt === 'all') return true;
            return row.bidangUpt === state.activeFilters.bidangUpt;
        };
        const matchProgram = (row) => {
            if (state.activeFilters.program === 'all') return true;
            return row.program === state.activeFilters.program;
        };
        const matchSearch = (row) => {
            if (!state.activeFilters.search || state.activeFilters.search.trim() === '') return true;
            const query = state.activeFilters.search.toLowerCase();
            return (row.program && row.program.toLowerCase().includes(query)) ||
                   (row.kegiatan && row.kegiatan.toLowerCase().includes(query)) ||
                   (row.subkegiatan && row.subkegiatan.toLowerCase().includes(query)) ||
                   (row.bidangUpt && row.bidangUpt.toLowerCase().includes(query)) ||
                   (row.kodeSubkegiatan && row.kodeSubkegiatan.toLowerCase().includes(query)) ||
                   (row.catatan && row.catatan.toLowerCase().includes(query));
        };
        const matchJenis = (row) => {
            if (state.activeFilters.jenisAnggaran === 'all') return true;
            return row.jenisAnggaran === state.activeFilters.jenisAnggaran;
        };

        BUDGET_DATA.forEach(row => {
            if (matchYear(row) && matchBidang(row) && matchProgram(row) && matchSearch(row) && matchJenis(row) && row.bidangUpt) {
                if (!bidangMap[row.bidangUpt]) {
                    bidangMap[row.bidangUpt] = { apbd: 0, papbd: 0, realisasi: 0 };
                }
                if (row.jenisAnggaran === 'APBD') {
                    bidangMap[row.bidangUpt].apbd += (row.anggaran || 0);
                }
                if (row.jenisAnggaran === 'P-APBD') {
                    bidangMap[row.bidangUpt].papbd += (row.anggaran || 0);
                }
                if (isRowInActiveSummaryScope(row)) {
                    bidangMap[row.bidangUpt].realisasi += (row.realisasi || 0);
                }
            }
        });

        // Display Bidang & UPT sorted in the exact organizational hierarchy order
        const desiredBidangOrder = [
            'Sekretariat',
            'Bidang Pengaturan dan Pengendalian',
            'Bidang Bina Teknik',
            'Bidang Pembangunan dan Peningkatan',
            'Bidang Pemeliharaan',
            'UPT PJJ Surabaya',
            'UPT PJJ Mojokerto',
            'UPT PJJ Bojonegoro',
            'UPT PJJ Madiun',
            'UPT PJJ Pacitan',
            'UPT PJJ Kediri',
            'UPT PJJ Malang',
            'UPT PJJ Probolinggo',
            'UPT PJJ Jember',
            'UPT PJJ Banyuwangi',
            'UPT PJJ Pamekasan',
            'UPT Laboratorium Pengujian Konstruksi'
        ];

        const getBidangOrderIndex = (name) => {
            let idx = desiredBidangOrder.indexOf(name);
            if (idx !== -1) return idx;
            if (name && name.includes('Pembangunan')) return 3;
            if (name && name.includes('Laboratorium')) return 16;
            return 99;
        };

        const sorted = Object.entries(bidangMap).sort((a, b) => {
            return getBidangOrderIndex(a[0]) - getBidangOrderIndex(b[0]);
        });
        const originalNames = sorted.map(item => item[0]);
        const formattedLabels = sorted.map(item => formatBidangLabel(item[0]));
        const apbdValues = sorted.map(item => item[1].apbd);
        const papbdValues = sorted.map(item => item[1].papbd);
        const realisasiValues = sorted.map(item => item[1].realisasi);
        const capaianValues = sorted.map(item => {
            const ang = item[1].papbd > 0 ? item[1].papbd : item[1].apbd;
            const rel = item[1].realisasi || 0;
            return ang > 0 && rel > 0 ? parseFloat((rel / ang * 100).toFixed(1)) : null;
        });

        // Update container width dynamically for breathing room
        const containerEl = document.getElementById('container-anggaran-bidang');
        const numBidang = sorted.length;
        if (containerEl) {
            containerEl.style.minWidth = numBidang > 8 ? `${Math.max(1750, numBidang * 105)}px` : '100%';
        }

        // Update Legend HTML for Bidang - modern 4-badge style identical to Realisasi Pagu Anggaran
        const legendBidangContainer = document.getElementById('legend-anggaran-bidang');
        if (legendBidangContainer) {
            legendBidangContainer.innerHTML = `
                <div class="d-flex align-items-center justify-content-center gap-4 text-xs flex-wrap">
                    <div class="d-flex align-items-center gap-2">
                        <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #fef08a 0%, #eab308 100%); border-radius: 3px; box-shadow: 0 2px 5px rgba(234, 179, 8, 0.35);"></span>
                        <span class="text-secondary fw-bold">APBD Murni</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); border-radius: 3px; box-shadow: 0 2px 5px rgba(217, 119, 6, 0.35);"></span>
                        <span class="text-secondary fw-bold">P-APBD</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #34d399 0%, #059669 100%); border-radius: 3px; box-shadow: 0 2px 5px rgba(5, 150, 105, 0.35);"></span>
                        <span class="text-secondary fw-bold">Realisasi</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 14px; position: relative;">
                            <span style="position: absolute; width: 100%; height: 3px; background-color: #2563eb; border-radius: 2px;"></span>
                            <span style="position: relative; width: 8px; height: 8px; background-color: #ffffff; border: 2.5px solid #2563eb; border-radius: 50%; z-index: 1; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.4);"></span>
                        </span>
                        <span class="text-secondary fw-bold">Capaian</span>
                    </div>
                </div>
            `;
        }

        // Plugin to render labels on top of bars & line points (horizontal, with white outline)
        const bidangBarLabelsPlugin = {
            id: 'bidangBarLabelsPlugin',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;

                // 1. Draw Capaian line labels
                chart.data.datasets.forEach((dataset, i) => {
                    if (dataset.type === 'line' || (dataset.label && dataset.label.includes('Capaian'))) {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((element, index) => {
                            const val = dataset.data[index];
                            if (val !== undefined && val !== null && !isNaN(val) && val > 0) {
                                const bName = originalNames[index];
                                const isMatched = (activeBidang === 'all') || (bName === activeBidang);
                                ctx.save();
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                ctx.font = isMatched ? '800 11px Poppins, sans-serif' : '500 8.5px Poppins, sans-serif';
                                ctx.strokeStyle = isMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
                                ctx.lineWidth = isMatched ? 3 : 1.5;
                                ctx.lineJoin = 'round';
                                const valText = val.toFixed(1).replace('.', ',') + '%';
                                ctx.strokeText(valText, element.x, element.y - (isMatched && activeBidang !== 'all' ? 9 : 7));
                                ctx.fillStyle = isMatched ? '#1d4ed8' : 'rgba(29, 78, 216, 0.32)';
                                ctx.fillText(valText, element.x, element.y - (isMatched && activeBidang !== 'all' ? 9 : 7));
                                ctx.restore();
                            }
                        });
                    }
                });

                // 2. Draw Bar value labels strictly horizontal without overlap
                const numCategories = sorted.length;
                for (let catIdx = 0; catIdx < numCategories; catIdx++) {
                    const bName = originalNames[catIdx];
                    const isMatched = (activeBidang === 'all') || (bName === activeBidang);
                    const barLabelsInCat = [];

                    chart.data.datasets.forEach((dataset, i) => {
                        if (dataset.type === 'bar') {
                            const meta = chart.getDatasetMeta(i);
                            const element = meta.data[catIdx];
                            if (!element) return;

                            const rawVal = dataset.data[catIdx];
                            if (rawVal !== undefined && rawVal !== null && rawVal > 0) {
                                let textColor = '#334155';
                                if (dataset.label === 'APBD Murni') {
                                    textColor = isMatched ? '#eab308' : 'rgba(234, 179, 8, 0.35)';
                                } else if (dataset.label === 'P-APBD') {
                                    textColor = isMatched ? '#b45309' : 'rgba(180, 83, 9, 0.32)';
                                } else if (dataset.label === 'Realisasi') {
                                    textColor = isMatched ? '#059669' : 'rgba(5, 150, 105, 0.32)';
                                }

                                const valText = formatShortRupiah(rawVal);
                                barLabelsInCat.push({
                                    x: element.x,
                                    y: element.y - 4,
                                    text: valText,
                                    color: textColor,
                                    isMatched: isMatched,
                                    rawVal: rawVal,
                                    label: dataset.label
                                });
                            }
                        }
                    });

                    if (barLabelsInCat.length === 0) continue;

                    // Sort bar labels by X coordinate (left to right)
                    barLabelsInCat.sort((a, b) => a.x - b.x);

                    // Prevent collision: if horizontal distance < 42px and vertical distance < 14px, stagger Y
                    for (let i = 0; i < barLabelsInCat.length; i++) {
                        for (let j = 0; j < i; j++) {
                            const lblA = barLabelsInCat[j];
                            const lblB = barLabelsInCat[i];
                            if (Math.abs(lblA.x - lblB.x) < 42) {
                                if (Math.abs(lblA.y - lblB.y) < 14) {
                                    if (lblA.y <= lblB.y) {
                                        lblA.y = lblB.y - 14;
                                    } else {
                                        lblB.y = lblA.y - 14;
                                    }
                                }
                            }
                        }
                    }

                    // Render strictly horizontal labels with white stroke outline for maximum legibility
                    barLabelsInCat.forEach(lbl => {
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = lbl.isMatched ? '700 9px Poppins, sans-serif' : '500 7.5px Poppins, sans-serif';
                        ctx.strokeStyle = lbl.isMatched ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
                        ctx.lineWidth = lbl.isMatched ? 3.5 : 1.5;
                        ctx.lineJoin = 'round';
                        ctx.strokeText(lbl.text, lbl.x, lbl.y);
                        ctx.fillStyle = lbl.color;
                        ctx.fillText(lbl.text, lbl.x, lbl.y);
                        ctx.restore();
                    });
                }
            }
        };

        state.charts.anggaranBidang = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: formattedLabels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Capaian',
                        data: capaianValues,
                        yAxisID: 'y1',
                        borderColor: '#2563eb',
                        borderWidth: 2.5,
                        backgroundColor: '#ffffff',
                        spanGaps: false,
                        pointRadius: capaianValues.map((v, idx) => {
                            if (v === null || v === undefined) return 0;
                            const bName = originalNames[idx];
                            return (activeBidang !== 'all' && bName === activeBidang) ? 7.5 : 5.0;
                        }),
                        pointHoverRadius: capaianValues.map(v => (v === null ? 0 : 8)),
                        pointBackgroundColor: originalNames.map(bName => (activeBidang !== 'all' && bName === activeBidang) ? '#2563eb' : '#ffffff'),
                        pointBorderColor: originalNames.map(bName => (activeBidang !== 'all' && bName === activeBidang) ? '#ffffff' : (activeBidang === 'all' ? '#2563eb' : 'rgba(37, 99, 235, 0.35)')),
                        pointBorderWidth: originalNames.map(bName => (activeBidang !== 'all' && bName === activeBidang) ? 3.5 : 2.5),
                        pointHoverBorderWidth: 3,
                        tension: 0.25,
                        fill: false,
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'APBD Murni',
                        data: apbdValues,
                        yAxisID: 'y',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            const idx = context.dataIndex;
                            const bName = originalNames[idx];
                            const isMatched = (activeBidang === 'all') || (bName === activeBidang);
                            if (!isMatched) return 'rgba(250, 204, 21, 0.28)';
                            if (!chartArea) return '#facc15';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, '#fef08a');
                            gradient.addColorStop(0.5, '#facc15');
                            gradient.addColorStop(1, '#eab308');
                            return gradient;
                        },
                        borderWidth: 0,
                        borderColor: 'transparent',
                        hoverBackgroundColor: '#eab308',
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom',
                        barPercentage: 0.80,
                        categoryPercentage: 0.78,
                        order: 2
                    },
                    {
                        type: 'bar',
                        label: 'P-APBD',
                        data: papbdValues,
                        yAxisID: 'y',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            const idx = context.dataIndex;
                            const bName = originalNames[idx];
                            const isMatched = (activeBidang === 'all') || (bName === activeBidang);
                            if (!isMatched) return 'rgba(245, 158, 11, 0.28)';
                            if (!chartArea) return '#f59e0b';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, '#fbbf24');
                            gradient.addColorStop(0.5, '#f59e0b');
                            gradient.addColorStop(1, '#d97706');
                            return gradient;
                        },
                        borderWidth: 0,
                        borderColor: 'transparent',
                        hoverBackgroundColor: '#d97706',
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom',
                        barPercentage: 0.80,
                        categoryPercentage: 0.78,
                        order: 3
                    },
                    {
                        type: 'bar',
                        label: 'Realisasi',
                        data: realisasiValues,
                        yAxisID: 'y',
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            const idx = context.dataIndex;
                            const bName = originalNames[idx];
                            const isMatched = (activeBidang === 'all') || (bName === activeBidang);
                            if (!isMatched) return 'rgba(16, 185, 129, 0.28)';
                            if (!chartArea) return '#10b981';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, '#34d399');
                            gradient.addColorStop(0.5, '#10b981');
                            gradient.addColorStop(1, '#059669');
                            return gradient;
                        },
                        borderWidth: 0,
                        borderColor: 'transparent',
                        hoverBackgroundColor: '#059669',
                        borderRadius: {
                            topLeft: 6,
                            topRight: 6,
                            bottomLeft: 0,
                            bottomRight: 0
                        },
                        borderSkipped: 'bottom',
                        barPercentage: 0.80,
                        categoryPercentage: 0.78,
                        order: 4
                    }
                ]
            },
            plugins: [bidangBarLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 42,
                        bottom: 10,
                        left: 10,
                        right: 15
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const idx = context[0].dataIndex;
                                return originalNames[idx] || '';
                            },
                            label: function(context) {
                                const val = context.raw;
                                if (context.dataset.type === 'line' || context.dataset.label.includes('Capaian')) {
                                    if (val === null || val === undefined) {
                                        return ` ${context.dataset.label}: Belum ada realisasi`;
                                    }
                                    return ` ${context.dataset.label}: ${val.toFixed(2).replace('.', ',')}%`;
                                }
                                if (val === null || val === undefined || val === 0) return ` ${context.dataset.label}: -`;
                                return ` ${context.dataset.label}: ${formatRupiah(val)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: function(context) {
                                const idx = context.tick ? context.tick.value : -1;
                                const bName = originalNames[idx];
                                const isMatched = (activeBidang === 'all') || (bName === activeBidang);
                                return {
                                    family: 'Poppins',
                                    size: 9.5,
                                    weight: isMatched ? '800' : '600'
                                };
                            },
                            color: function(context) {
                                const idx = context.tick ? context.tick.value : -1;
                                const bName = originalNames[idx];
                                if (activeBidang === 'all') return '#334155';
                                return bName === activeBidang ? '#0f172a' : '#94a3b8';
                            },
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        display: false,
                        beginAtZero: true,
                        grace: '90%',
                        grid: { display: false }
                    },
                    y1: {
                        display: false,
                        position: 'right',
                        min: 0,
                        max: 115,
                        grid: { display: false }
                    }
                }
            }
        });
    }

    const mappingTabEl = document.getElementById('mapping-tab');
    if (mappingTabEl) {
        mappingTabEl.addEventListener('shown.bs.tab', function () {
            renderMappingTab();
        });
    }

    if (elMappingTableBody) {
        elMappingTableBody.addEventListener('click', function (e) {
            const cell = e.target.closest('.clickable-cell');
            if (!cell) return;

            const subkegCode = cell.getAttribute('data-subkeg-code');
            const orgCode = cell.getAttribute('data-org-code');
            const yearType = cell.getAttribute('data-year-type');
            
            showCellDetails(subkegCode, orgCode, yearType);
        });
    }

    function getOrgInfo(bidangUptName) {
        if (!bidangUptName) return { code: '1.03.0.00.0.00.10.0000', name: 'DINAS PEKERJAAN UMUM BINA MARGA', isUpt: false, order: 1 };
        
        const nameUpper = bidangUptName.toUpperCase();
        if (nameUpper.includes('SURABAYA')) {
            return { code: '1.03.0.00.0.00.10.0001', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN SURABAYA', isUpt: true, order: 2 };
        } else if (nameUpper.includes('MOJOKERTO')) {
            return { code: '1.03.0.00.0.00.10.0002', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN MOJOKERTO', isUpt: true, order: 3 };
        } else if (nameUpper.includes('BOJONEGORO')) {
            return { code: '1.03.0.00.0.00.10.0003', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN BOJONEGORO', isUpt: true, order: 4 };
        } else if (nameUpper.includes('MADIUN')) {
            return { code: '1.03.0.00.0.00.10.0004', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN MADIUN', isUpt: true, order: 5 };
        } else if (nameUpper.includes('PACITAN')) {
            return { code: '1.03.0.00.0.00.10.0005', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN PACITAN', isUpt: true, order: 6 };
        } else if (nameUpper.includes('KEDIRI')) {
            return { code: '1.03.0.00.0.00.10.0006', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN KEDIRI', isUpt: true, order: 7 };
        } else if (nameUpper.includes('MALANG')) {
            return { code: '1.03.0.00.0.00.10.0007', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN MALANG', isUpt: true, order: 8 };
        } else if (nameUpper.includes('PROBOLINGGO')) {
            return { code: '1.03.0.00.0.00.10.0008', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN PROBOLINGGO', isUpt: true, order: 9 };
        } else if (nameUpper.includes('JEMBER')) {
            return { code: '1.03.0.00.0.00.10.0009', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN JEMBER', isUpt: true, order: 10 };
        } else if (nameUpper.includes('BANYUWANGI')) {
            return { code: '1.03.0.00.0.00.10.0010', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN BANYUWANGI', isUpt: true, order: 11 };
        } else if (nameUpper.includes('PAMEKASAN')) {
            return { code: '1.03.0.00.0.00.10.0011', name: 'UPT PENGELOLAAN JALAN DAN JEMBATAN PAMEKASAN', isUpt: true, order: 12 };
        } else if (nameUpper.includes('LABORATORIUM')) {
            return { code: '1.03.0.00.0.00.10.0012', name: 'UPT LABORATORIUM PENGUJIAN KONSTRUKSI', isUpt: true, order: 13 };
        }
        
        // Default to Dinas (Sekretariat, Bidang Pemeliharaan, Bidang Bina Teknik, Bidang Pembangunan, Bidang Pengaturan)
        return { code: '1.03.0.00.0.00.10.0000', name: 'DINAS PEKERJAAN UMUM BINA MARGA', isUpt: false, order: 1 };
    }

    function getDynamicColumns() {
        const pairsMap = {};
        BUDGET_DATA.forEach(row => {
            if (row.tahun && row.jenisAnggaran) {
                const key = `${row.tahun}_${row.jenisAnggaran}`;
                pairsMap[key] = { year: row.tahun, type: row.jenisAnggaran };
            }
        });

        const typeOrder = {
            'APBD': 1,
            'P-APBD Mendahului I': 2,
            'P-APBD Mendahului II': 3,
            'P-APBD Mendahului II (PEN)': 4,
            'P-APBD Mendahului III': 5,
            'P-APBD Pergeseran': 6,
            'P-APBD': 7
        };

        return Object.values(pairsMap).sort((a, b) => {
            if (a.year !== b.year) {
                return a.year - b.year;
            }
            const wA = typeOrder[a.type] || 99;
            const wB = typeOrder[b.type] || 99;
            return wA - wB;
        });
    }

    function getMappingData() {
        const subkegiatanMap = {};
        const cols = getDynamicColumns();

        BUDGET_DATA.forEach(row => {
            // Apply global filters (excluding Year and Jenis Anggaran)
            const matchBidang = state.activeFilters.bidangUpt === 'all' || row.bidangUpt === state.activeFilters.bidangUpt;
            const matchProgram = state.activeFilters.program === 'all' || row.program === state.activeFilters.program;
            
            if (!matchBidang || !matchProgram) return;

            // Apply mapping search filter
            const query = state.mappingSearch.toLowerCase().trim();
            const displayCode = row.kodeSubkegiatan.replace('X.XX', '1.03');
            const displayKodeProg = row.kodeProgram.replace('X.XX', '1.03');
            const displayKodeKeg = row.kodeKegiatan.replace('X.XX', '1.03');
            
            if (query !== '') {
                const matchSearch = displayCode.toLowerCase().includes(query) ||
                                    row.subkegiatan.toLowerCase().includes(query) ||
                                    row.program.toLowerCase().includes(query) ||
                                    row.kegiatan.toLowerCase().includes(query) ||
                                    row.bidangUpt.toLowerCase().includes(query);
                if (!matchSearch) return;
            }

            const orgInfo = getOrgInfo(row.bidangUpt);
            const key = `${orgInfo.code}_${displayCode}`;

            if (!subkegiatanMap[key]) {
                subkegiatanMap[key] = {
                    key: key,
                    orgInfo: orgInfo,
                    kodeSubkegiatan: displayCode,
                    subkegiatan: row.subkegiatan || '',
                    kodeKegiatan: displayKodeKeg,
                    kegiatan: row.kegiatan || '',
                    kodeProgram: displayKodeProg,
                    program: row.program || '',
                    indikator: row.indikator || '',
                    satuan: row.satuan || '',
                    values: {}
                };
                // Initialize all values to zero for dynamic columns
                cols.forEach(c => {
                    subkegiatanMap[key].values[`${c.year}_${c.type}`] = { budget: 0, target: 0, realisasi: 0, satuan: '' };
                });
            }

            // Fallback for missing indicator info in some rows
            if (!subkegiatanMap[key].indikator && row.indikator) {
                subkegiatanMap[key].indikator = row.indikator;
                subkegiatanMap[key].satuan = row.satuan || '';
            }

            const year = row.tahun;
            const type = row.jenisAnggaran;
            const budget = row.anggaran || 0;
            const target = row.nilaiIndikator || 0;
            const realisasi = row.realisasi || 0;

            const colKey = `${year}_${type}`;
            if (subkegiatanMap[key].values[colKey]) {
                subkegiatanMap[key].values[colKey].budget += budget;
                subkegiatanMap[key].values[colKey].target += target;
                subkegiatanMap[key].values[colKey].realisasi += realisasi;
                if (row.satuan) {
                    subkegiatanMap[key].values[colKey].satuan = row.satuan;
                }
            }
        });

        return Object.values(subkegiatanMap);
    }

    function bindMappingSearchListener() {
        const searchInput = document.getElementById('mapping-search');
        if (searchInput) {
            searchInput.value = state.mappingSearch;
            
            let mappingSearchTimeout;
            searchInput.addEventListener('input', function () {
                clearTimeout(mappingSearchTimeout);
                mappingSearchTimeout = setTimeout(() => {
                    state.mappingSearch = this.value;
                    state.mappingPagination.currentPage = 1;
                    renderMappingTab();
                }, 300);
            });
        }
    }

    function renderMappingTab() {
        if (!elMappingTableBody) return;

        const cols = getDynamicColumns();
        const list = getMappingData();
        
        // Sort: Dinas first (order 1), then UPTs (order 2-13), then Program, then Kegiatan, then Subkegiatan
        list.sort((a, b) => {
            if (a.orgInfo.order !== b.orgInfo.order) {
                return a.orgInfo.order - b.orgInfo.order;
            }
            if (a.kodeProgram !== b.kodeProgram) {
                return a.kodeProgram.localeCompare(b.kodeProgram);
            }
            if (a.kodeKegiatan !== b.kodeKegiatan) {
                return a.kodeKegiatan.localeCompare(b.kodeKegiatan);
            }
            return a.kodeSubkegiatan.localeCompare(b.kodeSubkegiatan);
        });

        const totalItems = list.length;
        let limit = state.mappingPagination.limit;
        if (limit !== 'all') {
            limit = parseInt(limit);
        }
        
        const totalPages = limit === 'all' ? 1 : Math.ceil(totalItems / limit);
        
        // Adjust current page if out of bounds
        if (state.mappingPagination.currentPage > totalPages) {
            state.mappingPagination.currentPage = Math.max(1, totalPages);
        }

        const startIdx = limit === 'all' ? 0 : (state.mappingPagination.currentPage - 1) * limit;
        const endIdx = limit === 'all' ? totalItems : Math.min(totalItems, startIdx + limit);
        
        const pageItems = list.slice(startIdx, endIdx);

        // Update summary text
        if (totalItems === 0) {
            if (elMappingSummary) elMappingSummary.textContent = 'Tidak ada subkegiatan ditemukan';
        } else {
            if (elMappingSummary) elMappingSummary.textContent = `Menampilkan ${startIdx + 1} s.d ${endIdx} dari ${totalItems.toLocaleString('id-ID')} subkegiatan`;
        }

        // Render dynamic table header
        const yearStyles = {
            2021: { bg: '#f1f5f9', fg: '#334155' }, // Slate
            2022: { bg: '#e0f2fe', fg: '#0369a1' }, // Sky Blue
            2023: { bg: '#fae8ff', fg: '#a21caf' }, // Purple
            2024: { bg: '#dcfce7', fg: '#15803d' }, // Green
            2025: { bg: '#fef9c3', fg: '#a16207' }, // Yellow
            2026: { bg: '#ffe4e6', fg: '#be123c' }  // Rose
        };
        const defaultStyle = { bg: '#f8fafc', fg: '#475569' };

        let headerColsHtml = '';
        cols.forEach(c => {
            const style = yearStyles[c.year] || defaultStyle;
            headerColsHtml += `
                <th scope="col" style="width: 140px; background-color: ${style.bg}; color: ${style.fg}; font-size: 0.7rem;" class="text-center py-2.5">
                    ${c.type} ${c.year}
                    <br><span class="text-xxs fw-normal opacity-75" style="font-size: 0.6rem;">Target / Anggaran / Rata-rata</span>
                </th>
            `;
        });

        const headerEl = document.getElementById('mapping-table-header');
        if (headerEl) {
            headerEl.innerHTML = `
                <tr class="align-middle text-center text-xs fw-bold">
                    <th scope="col" class="col-sticky-1">#</th>
                    <th scope="col" class="col-sticky-2">Status</th>
                    <th scope="col" class="text-start col-sticky-3">Sub Kegiatan</th>
                    ${headerColsHtml}
                    <th scope="col" style="width: 155px; background-color: #f97316; color: #ffffff;">Rule</th>
                </tr>
                <tr style="background-color: #f8fafc;">
                    <th colspan="2" class="col-sticky-span-1-2"></th>
                    <th class="col-sticky-3">
                        <input type="text" class="form-control form-control-sm border-light-subtle shadow-xs text-xs" id="mapping-search" placeholder="Cari kode atau nama subkegiatan...">
                    </th>
                    <th colspan="${cols.length + 1}"></th>
                </tr>
            `;
            bindMappingSearchListener();
        }

        const totalCols = cols.length + 4;

        // Render Table Body
        elMappingTableBody.innerHTML = '';
        
        if (pageItems.length === 0) {
            elMappingTableBody.innerHTML = `
                <tr>
                    <td colspan="${totalCols}" class="text-center text-muted py-5">
                        <i class="bi bi-inbox fs-2 mb-2 d-block"></i>
                        Tidak ada data subkegiatan yang sesuai dengan filter pencarian.
                    </td>
                </tr>
            `;
            renderMappingPagination(0);
            return;
        }

        let lastOrgCode = '';
        let lastProgCode = '';
        let lastKegCode = '';

        // Determine latest APBD years in BUDGET_DATA for Rule cell comparison
        const allYears = Array.from(new Set(BUDGET_DATA.map(r => r.tahun))).sort();
        const latestYear = allYears[allYears.length - 1] || 2026;
        const prevYear = allYears[allYears.length - 2] || 2025;

        pageItems.forEach((item, idx) => {
            // Render Org Header if changed
            if (item.orgInfo.code !== lastOrgCode) {
                const orgRow = document.createElement('tr');
                orgRow.className = 'row-dinas-group';
                orgRow.innerHTML = `<td colspan="${totalCols}" class="col-sticky-group" style="padding-left: 0 !important;"><div style="position: sticky; left: 120px; display: inline-block; white-space: nowrap;"><i class="bi bi-bank me-2"></i> ${item.orgInfo.code} - ${item.orgInfo.name}</div></td>`;
                elMappingTableBody.appendChild(orgRow);
                lastOrgCode = item.orgInfo.code;
                
                // Force Program and Kegiatan headers to redraw under new UPT
                lastProgCode = '';
                lastKegCode = '';
            }

            // Render Program Header if changed
            if (item.kodeProgram !== lastProgCode) {
                const progRow = document.createElement('tr');
                progRow.className = 'row-program-group';
                progRow.innerHTML = `<td colspan="${totalCols}" class="col-sticky-group" style="padding-left: 0 !important;"><div style="position: sticky; left: 140px; display: inline-block; white-space: nowrap;"><i class="bi bi-folder2-open me-2"></i> ${item.kodeProgram} - ${item.program}</div></td>`;
                elMappingTableBody.appendChild(progRow);
                lastProgCode = item.kodeProgram;
                
                // Force Kegiatan header to redraw under new Program
                lastKegCode = ''; 
            }

            // Render Kegiatan Header if changed
            if (item.kodeKegiatan !== lastKegCode) {
                const kegRow = document.createElement('tr');
                kegRow.className = 'row-kegiatan-group';
                kegRow.innerHTML = `<td colspan="${totalCols}" class="col-sticky-group" style="padding-left: 0 !important;"><div style="position: sticky; left: 160px; display: inline-block; white-space: nowrap;"><i class="bi bi-arrow-right-short me-1"></i> ${item.kodeKegiatan} - ${item.kegiatan}</div></td>`;
                elMappingTableBody.appendChild(kegRow);
                lastKegCode = item.kodeKegiatan;
            }

            // Render Subkegiatan Row
            const tr = document.createElement('tr');
            const rowNum = startIdx + idx + 1;
            
            // Check status indicator: green dot (Aktif), red dot (Drop), or grey dot (Non-aktif)
            let statusDot = '';
            const latestApbdKey = `${latestYear}_APBD`;
            const prevApbdKey = `${prevYear}_APBD`;
            const prevPapbdKey = `${prevYear}_PAPBD`;

            if (item.values[latestApbdKey] && item.values[latestApbdKey].budget > 0) {
                statusDot = '<span class="badge bg-success-subtle text-success px-2 py-1" style="font-size: 0.65rem;">Aktif</span>';
            } else if ((item.values[prevApbdKey] && item.values[prevApbdKey].budget > 0) || (item.values[prevPapbdKey] && item.values[prevPapbdKey].budget > 0)) {
                statusDot = '<span class="badge bg-danger text-white px-2 py-1" style="font-size: 0.65rem;">Drop</span>';
            } else {
                statusDot = '<span class="badge bg-secondary-subtle text-secondary px-2 py-1" style="font-size: 0.65rem;">Non-Aktif</span>';
            }

            // Generate cell content with comparison values for inline Delta dynamically
            let cellHtmls = '';
            cols.forEach(c => {
                const colKey = `${c.year}_${c.type}`;
                const val = item.values[colKey];
                
                // Find prevVal based on rule
                let prevVal = null;
                if (c.type === 'APBD') {
                    // Compare with APBD of previous year
                    const prevKey = `${c.year - 1}_APBD`;
                    if (item.values[prevKey]) {
                        prevVal = item.values[prevKey];
                    }
                } else {
                    // Compare with APBD of same year
                    const sameYearApbdKey = `${c.year}_APBD`;
                    if (item.values[sameYearApbdKey]) {
                        prevVal = item.values[sameYearApbdKey];
                    }
                }
                
                const cHtml = renderMappingCell(val, prevVal);
                cellHtmls += `
                    <td class="clickable-cell" data-subkeg-code="${item.kodeSubkegiatan}" data-org-code="${item.orgInfo.code}" data-year-type="${colKey}">
                        ${cHtml}
                    </td>
                `;
            });

            const cRule = renderRuleCell(
                item.values[`${prevYear}_APBD`], 
                item.values[`${latestYear}_APBD`],
                prevYear,
                latestYear
            );

            tr.innerHTML = `
                <td class="text-center fw-semibold text-muted col-sticky-1">${rowNum}</td>
                <td class="text-center col-sticky-2">${statusDot}</td>
                <td class="col-sticky-3">
                    <div class="fw-semibold text-dark text-xs">${item.kodeSubkegiatan} - ${item.subkegiatan}</div>
                    ${item.indikator ? `
                    <div class="indicator-card">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="badge-indicator">Indikator</span>
                            <span class="badge-dssd">DSSD</span>
                            <span class="text-muted" style="font-size: 0.65rem;">Satuan: <strong>${item.satuan}</strong></span>
                        </div>
                        <div class="text-secondary text-xxs text-truncate-hover" style="white-space: normal; line-height: 1.3;">
                            ${item.indikator}
                        </div>
                    </div>
                    ` : ''}
                </td>
                ${cellHtmls}
                <td class="text-center">${cRule}</td>
            `;

            elMappingTableBody.appendChild(tr);
        });

        renderMappingPagination(totalItems);
        setTimeout(adjustStickyOffsets, 20);
    }

    function adjustStickyOffsets() {
        const table = document.querySelector('.mapping-table');
        if (!table) return;
        
        const row1 = table.querySelector('thead tr:nth-child(1)');
        const row2 = table.querySelector('thead tr:nth-child(2)');
        
        if (row1 && row2) {
            const h1 = row1.getBoundingClientRect().height;
            const h2 = row2.getBoundingClientRect().height;
            const totalHead = h1 + h2;
            
            const row2Ths = row2.querySelectorAll('th');
            row2Ths.forEach(th => {
                th.style.position = 'sticky';
                th.style.top = `${h1}px`;
            });
            
            const dinasTds = table.querySelectorAll('tr.row-dinas-group td');
            dinasTds.forEach(td => {
                td.style.position = 'sticky';
                td.style.top = `${totalHead}px`;
            });
            
            let hDinas = 38;
            const firstDinas = table.querySelector('tr.row-dinas-group td');
            if (firstDinas) {
                hDinas = firstDinas.getBoundingClientRect().height;
            }
            
            const progTds = table.querySelectorAll('tr.row-program-group td');
            progTds.forEach(td => {
                td.style.position = 'sticky';
                td.style.top = `${totalHead + hDinas}px`;
            });
            
            let hProg = 38;
            const firstProg = table.querySelector('tr.row-program-group td');
            if (firstProg) {
                hProg = firstProg.getBoundingClientRect().height;
            }
            
            const kegTds = table.querySelectorAll('tr.row-kegiatan-group td');
            kegTds.forEach(td => {
                td.style.position = 'sticky';
                td.style.top = `${totalHead + hDinas + hProg}px`;
            });
        }
    }

    function renderMappingCell(val, prevVal) {
        if (!val || (val.budget === 0 && val.target === 0)) {
            return `
                <div class="text-center text-muted text-xxs">-</div>
            `;
        }
        
        const formattedBudget = formatShortRupiah(val.budget);
        const fullBudget = formatRupiah(val.budget);
        const formattedTarget = val.target > 0 ? `${val.target.toLocaleString('id-ID')} ${val.satuan || ''}` : '-';
        
        let avgText = '-';
        if (val.target > 0 && val.budget > 0) {
            const avg = val.budget / val.target;
            avgText = formatShortRupiah(avg);
        }

        // Calculate Delta inline if prevVal is provided
        let deltaHtml = '';
        if (prevVal && prevVal.budget > 0) {
            const diff = val.budget - prevVal.budget;
            if (diff !== 0) {
                const pct = (diff / prevVal.budget * 100);
                const sign = diff > 0 ? '▲' : '▼';
                const colorClass = diff > 0 ? 'text-success' : 'text-danger';
                const pctText = `${diff > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                deltaHtml = `
                    <div class="text-xxs ${colorClass} fw-bold mt-2" title="Selisih dibanding anggaran sebelumnya: ${formatRupiah(diff)}">
                        ${sign} ${formatShortRupiah(Math.abs(diff))} (${pctText})
                    </div>
                `;
            } else {
                deltaHtml = `<div class="text-xxs text-muted mt-2">0%</div>`;
            }
        } else if (prevVal && prevVal.budget === 0 && val.budget > 0) {
            deltaHtml = `
                <div class="text-xxs text-success fw-bold mt-2">
                    ▲ ${formattedBudget} (Baru)
                </div>
            `;
        }

        let realisasiHtml = '';
        if (val.realisasi > 0) {
            const pctRealisasi = val.budget > 0 ? Math.min(100, (val.realisasi / val.budget * 100)).toFixed(1) : '100';
            const formattedRealisasi = formatShortRupiah(val.realisasi);
            realisasiHtml = `
                <div class="text-xxs text-success fw-semibold mt-1" title="Realisasi: ${formatRupiah(val.realisasi)}">
                    <span style="color: #059669;">Real:</span> ${formattedRealisasi} (${pctRealisasi}%)
                </div>
            `;
        }

        return `
            <div class="text-center">
                <div class="fw-semibold text-dark mb-1 text-xs" title="Target">${formattedTarget}</div>
                <div class="text-xxs text-secondary mb-1" title="Anggaran: ${fullBudget}">
                    <span class="mapping-budget-lbl">Angg:</span> <strong>${formattedBudget}</strong>
                </div>
                <div class="text-xxs text-muted" title="Rata-rata per satuan">
                    <span class="mapping-avg-lbl">Rata2:</span> ${avgText}
                </div>
                ${realisasiHtml}
                ${deltaHtml}
            </div>
        `;
    }

    function renderDeltaCell(val2025, val2026) {
        const budget2025 = val2025 ? val2025.budget : 0;
        const budget2026 = val2026 ? val2026.budget : 0;
        
        if (budget2026 === 0 && budget2025 === 0) {
            return `<div class="text-center text-muted text-xxs">-</div>`;
        }
        
        const diff = budget2026 - budget2025;
        if (diff === 0) {
            return `<div class="text-center text-muted fw-semibold">0%</div>`;
        }
        
        const pct = budget2025 > 0 ? (diff / budget2025 * 100) : 0;
        const sign = diff > 0 ? '▲' : '▼';
        const colorClass = diff > 0 ? 'text-success' : 'text-danger';
        const pctText = budget2025 > 0 ? ` (${diff > 0 ? '+' : ''}${pct.toFixed(1)}%)` : '';
        
        return `
            <div class="text-center ${colorClass} fw-bold text-xs">
                <div>${sign} ${formatShortRupiah(Math.abs(diff))}</div>
                <div style="font-size: 0.65rem; font-weight: normal;">${pctText}</div>
            </div>
        `;
    }

    function renderRuleCell(valPrev, valLatest, prevYear, latestYear) {
        const budgetPrev = valPrev ? valPrev.budget : 0;
        const budgetLatest = valLatest ? valLatest.budget : 0;
        const targetPrev = valPrev ? valPrev.target : 0;
        const targetLatest = valLatest ? valLatest.target : 0;
        
        const yrPrev = prevYear || 2025;
        const yrLatest = latestYear || 2026;
        
        if (budgetLatest === 0) {
            if (budgetPrev > 0) {
                return `<span class="badge-rule-red">Subkegiatan Dihapus atau tidak digunakan</span>`;
            }
            return `<span class="badge-rule-yellow">Kegiatan Rp 0</span>`;
        }
        
        if (budgetPrev === 0) {
            return `<span class="badge-rule-blue">Baru di ${yrLatest}</span>`;
        }
        
        if (targetPrev === targetLatest && budgetLatest !== budgetPrev) {
            return `<span class="badge-rule-orange">Target sama, alokasi anggaran berbeda dengan APBD ${yrPrev}</span>`;
        }
        
        if (targetLatest > targetPrev && budgetLatest < budgetPrev) {
            return `<span class="badge-rule-red">Anomali: Target naik, anggaran turun</span>`;
        }
        
        if (targetLatest < targetPrev && budgetLatest > budgetPrev) {
            return `<span class="badge-rule-red">Anomali: Target turun, anggaran naik</span>`;
        }
        
        return `<span class="badge-rule-green">Konsisten</span>`;
    }

    function renderMappingPagination(totalItems) {
        if (!elMappingPaginationContainer) return;
        elMappingPaginationContainer.innerHTML = '';
        let limit = state.mappingPagination.limit;
        if (limit === 'all') return;
        
        limit = parseInt(limit);
        const totalPages = Math.ceil(totalItems / limit);
        if (totalPages <= 1) return;

        const maxVisiblePages = 5;
        let startPage = Math.max(1, state.mappingPagination.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Prev button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${state.mappingPagination.currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Sebelumnya"><span aria-hidden="true">&laquo;</span></a>`;
        prevLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.mappingPagination.currentPage > 1) {
                state.mappingPagination.currentPage--;
                renderMappingTab();
            }
        });
        elMappingPaginationContainer.appendChild(prevLi);

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${state.mappingPagination.currentPage === i ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                state.mappingPagination.currentPage = i;
                renderMappingTab();
            });
            elMappingPaginationContainer.appendChild(li);
        }

        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${state.mappingPagination.currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Selanjutnya"><span aria-hidden="true">&raquo;</span></a>`;
        nextLi.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.mappingPagination.currentPage < totalPages) {
                state.mappingPagination.currentPage++;
                renderMappingTab();
            }
        });
        elMappingPaginationContainer.appendChild(nextLi);
    }

    function showRowDetails(rowNo) {
        const row = BUDGET_DATA.find(r => r.no === rowNo);
        if (!row) return;
        
        const modalBody = document.getElementById('modal-row-details-body');
        if (!modalBody) return;
        
        const budgetText = row.anggaran === 0 ? 'Rp 0' : formatRupiah(row.anggaran);
        const targetText = row.nilaiIndikator > 0 ? `${row.nilaiIndikator.toLocaleString('id-ID')} ${row.satuan || ''}` : '-';
        
        modalBody.innerHTML = `
            <div class="row g-3">
                <div class="col-12 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Unit Kerja / Bidang UPT</div>
                    <div class="fw-bold text-dark text-xs">${row.bidangUpt}</div>
                </div>
                
                <div class="col-12 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Program</div>
                    <div class="fw-bold text-dark text-xs">${row.kodeProgram} - ${row.program}</div>
                </div>
                
                <div class="col-12 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Kegiatan</div>
                    <div class="fw-bold text-dark text-xs">${row.kodeKegiatan} - ${row.kegiatan}</div>
                </div>
                
                <div class="col-12 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Subkegiatan</div>
                    <div class="fw-bold text-dark text-xs">${row.kodeSubkegiatan} - ${row.subkegiatan}</div>
                </div>
                
                <div class="col-md-6 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Indikator Kinerja</div>
                    <div class="fw-bold text-dark text-xs" style="white-space: normal;">${row.indikator || '-'}</div>
                </div>
                
                <div class="col-md-6 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Target Kinerja</div>
                    <div class="fw-bold text-dark text-xs">${targetText}</div>
                </div>
                
                <div class="${row.realisasi > 0 ? 'col-md-3' : 'col-md-4'} pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Tahun Anggaran</div>
                    <div class="fw-bold text-dark text-xs">${row.tahun}</div>
                </div>
                
                <div class="${row.realisasi > 0 ? 'col-md-3' : 'col-md-4'} pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Jenis Anggaran</div>
                    <div class="fw-bold text-dark text-xs">
                        <span class="badge text-xxs px-2 py-1" style="${row.jenisAnggaran === 'APBD' ? 'background-color: #dbeafe; color: #1e40af;' : 'background-color: #f3e8ff; color: #6b21a8;'}">
                            ${row.jenisAnggaran}
                        </span>
                    </div>
                </div>
                
                <div class="${row.realisasi > 0 ? 'col-md-3' : 'col-md-4'} pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Alokasi Anggaran</div>
                    <div class="fw-bold text-primary text-xs">${budgetText}</div>
                </div>

                ${row.realisasi > 0 ? `
                <div class="col-md-3 pb-2 border-bottom">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Realisasi Belanja</div>
                    <div class="fw-bold text-success text-xs" style="color: #059669 !important;">
                        ${formatRupiah(row.realisasi)} (${Math.min(100, (row.realisasi / (row.anggaran || 1) * 100)).toFixed(2)}%)
                    </div>
                </div>
                ` : ''}
                
                <div class="col-12">
                    <div class="text-xxs text-muted text-uppercase fw-semibold mb-1" style="font-size: 0.65rem; letter-spacing: 0.05em;">Catatan / Keterangan</div>
                    <div class="bg-light p-3 rounded text-xs text-secondary" style="white-space: pre-wrap; word-break: break-word; font-family: inherit; line-height: 1.4;">
                        ${row.catatan ? row.catatan : '<em class="text-muted">Tidak ada catatan</em>'}
                    </div>
                </div>
            </div>
        `;
        
        const rowDetailsModalObj = new bootstrap.Modal(document.getElementById('rowDetailsModal'));
        rowDetailsModalObj.show();
    }

    function showCellDetails(subkegCode, orgCode, yearType) {
        // Parse year & type
        const parts = yearType.split('_');
        const year = parseInt(parts[0]);
        let type = parts[1];
        if (type === 'PAPBD') type = 'P-APBD';

        // Filter rows matching this subkeg, org, year and type
        const matchingRows = BUDGET_DATA.filter(row => {
            const displayCode = row.kodeSubkegiatan.replace('X.XX', '1.03');
            const matchSubkeg = displayCode === subkegCode;
            const matchOrg = getOrgInfo(row.bidangUpt).code === orgCode;
            const matchYear = row.tahun === year;
            const matchType = row.jenisAnggaran === type;
            return matchSubkeg && matchOrg && matchYear && matchType;
        });

        const modalBody = document.getElementById('modal-details-body');
        if (!modalBody) return;

        if (matchingRows.length === 0) {
            modalBody.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-exclamation-triangle fs-2 mb-2 d-block"></i>
                    Tidak ada rincian data transaksi untuk sel ini.
                </div>
            `;
            const myModal = new bootstrap.Modal(document.getElementById('cellDetailsModal'));
            myModal.show();
            return;
        }

        // Get subkegiatan and UPT info from first row
        const first = matchingRows[0];
        const displaySubkegName = `${subkegCode} - ${first.subkegiatan}`;
        const displayOrgName = getOrgInfo(first.bidangUpt).name;

        // Calculate aggregated values
        const totalBudget = matchingRows.reduce((sum, r) => sum + (r.anggaran || 0), 0);
        const totalTarget = matchingRows.reduce((sum, r) => sum + (r.nilaiIndikator || 0), 0);
        const totalRealisasi = matchingRows.reduce((sum, r) => sum + (r.realisasi || 0), 0);
        const satuan = first.satuan || '';

        let detailListHtml = '';
        matchingRows.forEach((r, idx) => {
            const fullAnggaran = formatRupiah(r.anggaran || 0);
            const targetVal = r.nilaiIndikator > 0 ? `${r.nilaiIndikator.toLocaleString('id-ID')} ${satuan}` : '-';
            const noteText = r.catatan ? r.catatan.trim() : '<span class="text-muted italic">Tidak ada catatan</span>';
            const bidangName = r.bidangUpt || 'Dinas (Kantor Pusat)';

            let realBlock = '';
            let budgetColClass = 'col-6';
            let targetColClass = 'col-6';
            if (r.realisasi > 0) {
                budgetColClass = 'col-4';
                targetColClass = 'col-4';
                const pct = Math.min(100, (r.realisasi / (r.anggaran || 1) * 100)).toFixed(2);
                realBlock = `
                    <div class="col-4">
                        <div class="text-xxs text-muted text-uppercase fw-semibold">Realisasi Belanja</div>
                        <div class="text-xs fw-bold text-success" style="color: #059669 !important;">${formatRupiah(r.realisasi)} (${pct}%)</div>
                    </div>
                `;
            }

            detailListHtml += `
                <div class="card border-light shadow-xs mb-3">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3">
                        <span class="text-xs fw-bold text-secondary"><i class="bi bi-person me-1"></i> Pelaksana: ${bidangName}</span>
                        <span class="badge bg-secondary text-white text-xxs">No. Excel: ${r.no || idx + 1}</span>
                    </div>
                    <div class="card-body p-3">
                        <div class="row g-2 mb-2">
                            <div class="${budgetColClass}">
                                <div class="text-xxs text-muted text-uppercase fw-semibold">Alokasi Anggaran</div>
                                <div class="text-xs fw-bold text-dark">${fullAnggaran}</div>
                            </div>
                            <div class="${targetColClass}">
                                <div class="text-xxs text-muted text-uppercase fw-semibold">Target Indikator</div>
                                <div class="text-xs fw-semibold text-dark">${targetVal}</div>
                            </div>
                            ${realBlock}
                        </div>
                        <div class="mt-2 pt-2 border-top border-light">
                            <div class="text-xxs text-muted text-uppercase fw-semibold mb-1">Catatan/Keterangan</div>
                            <div class="text-xs text-secondary bg-light p-2 rounded" style="white-space: normal; word-break: break-word; line-height: 1.4;">
                                ${noteText}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Set Title
        document.getElementById('cellDetailsModalLabel').innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-list-stars fs-5 text-primary"></i>
                <div>
                    <div class="fw-bold text-dark text-xs text-uppercase" style="letter-spacing: 0.05em;">Rincian Alokasi Belanja (${type} ${year})</div>
                    <div class="text-muted text-xxs fw-normal">${displayOrgName}</div>
                </div>
            </div>
        `;

        // Set Body HTML
        let aggregatedRealisasiHtml = '';
        if (totalRealisasi > 0) {
            const pct = Math.min(100, (totalRealisasi / (totalBudget || 1) * 100)).toFixed(2);
            aggregatedRealisasiHtml = `
                <div class="border-start border-light ps-3">
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Realisasi Gabungan</div>
                    <div class="text-xs fw-bold text-success" style="color: #059669 !important;">${formatRupiah(totalRealisasi)} (${pct}%)</div>
                </div>
            `;
        }

        modalBody.innerHTML = `
            <div class="mb-4 pb-3 border-bottom border-light">
                <div class="text-xxs text-muted text-uppercase fw-semibold mb-1">Subkegiatan</div>
                <h6 class="text-xs fw-bold text-dark mb-2">${displaySubkegName}</h6>
                <div class="badge bg-primary-subtle text-primary text-xxs px-2 py-1 mb-1">
                    Indikator: ${first.indikator || '-'}
                </div>
                
                <div class="bg-light-subtle border rounded p-3 mt-3 d-flex justify-content-between align-items-center">
                    <div>
                        <div class="text-xxs text-muted text-uppercase fw-semibold">Total Anggaran Gabungan</div>
                        <div class="text-sm fw-bold text-primary">${formatRupiah(totalBudget)}</div>
                    </div>
                    ${aggregatedRealisasiHtml}
                    <div class="text-end">
                        <div class="text-xxs text-muted text-uppercase fw-semibold">Total Target Gabungan</div>
                        <div class="text-xs fw-bold text-dark">${totalTarget > 0 ? `${totalTarget.toLocaleString('id-ID')} ${satuan}` : '-'}</div>
                    </div>
                </div>
            </div>
            
            <div class="text-xxs text-muted text-uppercase fw-bold mb-2"><i class="bi bi-file-earmark-text me-1"></i> Rincian Berkas Excel (${matchingRows.length} Transaksi)</div>
            <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                ${detailListHtml}
            </div>
        `;

        // Show Modal
        const cellDetailsModalObj = new bootstrap.Modal(document.getElementById('cellDetailsModal'));
        cellDetailsModalObj.show();
    }

    function showAllBidangDetails() {
        const data = state.filteredData;
        const totalBudget = data.reduce((sum, r) => sum + (r.anggaran || 0), 0);
        
        // Group by UPT/Bidang
        const groups = {};
        data.forEach(r => {
            const key = r.bidangUpt || 'Dinas (Kantor Pusat)';
            if (!groups[key]) {
                groups[key] = {
                    name: key,
                    budget: 0,
                    subkegCount: new Set()
                };
            }
            groups[key].budget += r.anggaran || 0;
            if (r.kodeSubkegiatan) {
                groups[key].subkegCount.add(r.kodeSubkegiatan);
            }
        });

        const sortedList = Object.values(groups).sort((a, b) => b.budget - a.budget);

        let tableRowsHtml = '';
        sortedList.forEach((item, idx) => {
            const pct = totalBudget > 0 ? ((item.budget / totalBudget) * 100).toFixed(1) + '%' : '0%';
            const orgNameFull = getOrgInfo(item.name).name;
            tableRowsHtml += `
                <tr>
                    <td class="text-center text-xs fw-semibold text-muted" style="width: 50px;">${idx + 1}</td>
                    <td class="text-xs text-dark fw-bold">
                        <div>${item.name}</div>
                        <div class="text-xxs text-muted fw-normal" style="margin-top: 1px;">${orgNameFull}</div>
                    </td>
                    <td class="text-xs fw-bold text-dark text-end">${formatRupiah(item.budget)}</td>
                    <td class="text-xs text-secondary text-end">${pct}</td>
                    <td class="text-center text-xs text-dark fw-semibold" style="width: 100px;">${item.subkegCount.size}</td>
                </tr>
            `;
        });

        const modalBody = document.getElementById('modal-bidang-details-body');
        if (!modalBody) return;

        // Set Title
        const displayYear = state.activeFilters.tahun === 'all' ? 'Semua Tahun' : `Tahun ${state.activeFilters.tahun}`;
        const displayJenis = state.activeFilters.jenisAnggaran === 'all' ? 'Semua Versi Anggaran' : state.activeFilters.jenisAnggaran;

        document.getElementById('bidangDetailsModalLabel').innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-bank fs-5 text-primary"></i>
                <div>
                    <div class="fw-bold text-dark text-xs text-uppercase" style="letter-spacing: 0.05em;">Rincian Alokasi Semua Unit Kerja</div>
                    <div class="text-muted text-xxs fw-normal">${displayYear} &bull; ${displayJenis}</div>
                </div>
            </div>
        `;

        // Total subkegiatans across all (unique count)
        const totalSubkegSet = new Set(data.map(r => r.kodeSubkegiatan).filter(Boolean));

        // Set Body HTML
        modalBody.innerHTML = `
            <div class="bg-light-subtle border rounded p-3 mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Anggaran Belanja (Aktif)</div>
                    <div class="text-sm fw-bold text-primary">${formatRupiah(totalBudget)}</div>
                </div>
                <div class="text-end">
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Subkegiatan (Aktif)</div>
                    <div class="text-xs fw-bold text-dark">${totalSubkegSet.size} Subkegiatan</div>
                </div>
            </div>

            <div class="table-responsive border rounded bg-white" style="max-height: 400px; overflow-y: auto;">
                <table class="table table-sm table-hover mb-0 align-middle">
                    <thead class="table-light sticky-top" style="z-index: 1;">
                        <tr>
                            <th class="text-center text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 50px;">No</th>
                            <th class="text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem;">Unit Pelaksana (Bidang/UPT)</th>
                            <th class="text-end text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem;">Total Anggaran</th>
                            <th class="text-end text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem;">Porsi (%)</th>
                            <th class="text-center text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 100px;">Subkegiatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || `<tr><td colspan="5" class="text-center text-muted py-4 text-xs">Tidak ada data unit kerja</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        // Show Modal
        const bidangDetailsModalObj = new bootstrap.Modal(document.getElementById('bidangDetailsModal'));
        bidangDetailsModalObj.show();
    }

    function showAllProgramDetails() {
        const data = state.filteredData;
        const totalBudget = data.reduce((sum, r) => sum + (r.anggaran || 0), 0);
        
        // Group by Program
        const groups = {};
        data.forEach(r => {
            const key = r.program || 'Program Lainnya';
            if (!groups[key]) {
                groups[key] = {
                    name: key,
                    budget: 0,
                    subkegCount: new Set()
                };
            }
            groups[key].budget += r.anggaran || 0;
            if (r.kodeSubkegiatan) {
                groups[key].subkegCount.add(r.kodeSubkegiatan);
            }
        });

        const sortedList = Object.values(groups).sort((a, b) => b.budget - a.budget);

        let tableRowsHtml = '';
        sortedList.forEach((item, idx) => {
            const pct = totalBudget > 0 ? ((item.budget / totalBudget) * 100).toFixed(1) + '%' : '0%';
            tableRowsHtml += `
                <tr>
                    <td class="text-center text-xs fw-semibold text-muted" style="width: 50px;">${idx + 1}</td>
                    <td class="text-xs text-dark fw-bold">${item.name}</td>
                    <td class="text-xs fw-bold text-dark text-end">${formatRupiah(item.budget)}</td>
                    <td class="text-xs text-secondary text-end">${pct}</td>
                    <td class="text-center text-xs text-dark fw-semibold" style="width: 100px;">${item.subkegCount.size}</td>
                </tr>
            `;
        });

        const modalBody = document.getElementById('modal-program-details-body');
        if (!modalBody) return;

        const displayYear = state.activeFilters.tahun === 'all' ? 'Semua Tahun' : `Tahun ${state.activeFilters.tahun}`;
        const displayJenis = state.activeFilters.jenisAnggaran === 'all' ? 'Semua Versi Anggaran' : state.activeFilters.jenisAnggaran;

        // Set Title
        document.getElementById('programDetailsModalLabel').innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-folder2-open fs-5 text-primary"></i>
                <div>
                    <div class="fw-bold text-dark text-xs text-uppercase" style="letter-spacing: 0.05em;">Rincian Alokasi Semua Program Kerja</div>
                    <div class="text-muted text-xxs fw-normal">${displayYear} &bull; ${displayJenis}</div>
                </div>
            </div>
        `;

        const totalSubkegSet = new Set(data.map(r => r.kodeSubkegiatan).filter(Boolean));

        // Set Body HTML
        modalBody.innerHTML = `
            <div class="bg-light-subtle border rounded p-3 mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Anggaran Belanja (Aktif)</div>
                    <div class="text-sm fw-bold text-primary">${formatRupiah(totalBudget)}</div>
                </div>
                <div class="text-end">
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Subkegiatan (Aktif)</div>
                    <div class="text-xs fw-bold text-dark">${totalSubkegSet.size} Subkegiatan</div>
                </div>
            </div>

            <div class="table-responsive border rounded bg-white" style="max-height: 400px; overflow-y: auto;">
                <table class="table table-sm table-hover mb-0 align-middle">
                    <thead class="table-light sticky-top" style="z-index: 1;">
                        <tr>
                            <th class="text-center text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 50px;">No</th>
                            <th class="text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem;">Nama Program</th>
                            <th class="text-end text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 150px;">Total Anggaran</th>
                            <th class="text-end text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 80px;">Porsi (%)</th>
                            <th class="text-center text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 100px;">Subkegiatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || `<tr><td colspan="5" class="text-center text-muted py-4 text-xs">Tidak ada data program</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        const myModal = new bootstrap.Modal(document.getElementById('programDetailsModal'));
        myModal.show();
    }

    function showAllSubkegiatanDetails() {
        const data = state.filteredData;
        const totalBudget = data.reduce((sum, r) => sum + (r.anggaran || 0), 0);
        
        // Group by Subkegiatan (aggregate across UPTs/Bidangs)
        const groups = {};
        data.forEach(r => {
            const key = r.kodeSubkegiatan;
            if (!groups[key]) {
                groups[key] = {
                    kode: r.kodeSubkegiatan.replace('X.XX', '1.03'),
                    name: r.subkegiatan || '',
                    budget: 0,
                    target: 0,
                    satuan: r.satuan || '',
                    pelaksana: new Set()
                };
            }
            groups[key].budget += r.anggaran || 0;
            groups[key].target += r.nilaiIndikator || 0;
            if (r.bidangUpt) {
                groups[key].pelaksana.add(r.bidangUpt);
            }
        });

        const sortedList = Object.values(groups).sort((a, b) => b.budget - a.budget);

        let tableRowsHtml = '';
        sortedList.forEach((item, idx) => {
            const pct = totalBudget > 0 ? ((item.budget / totalBudget) * 100).toFixed(1) + '%' : '0%';
            const pelaksanaList = Array.from(item.pelaksana).join(', ') || '-';
            const targetText = item.target > 0 ? `${item.target.toLocaleString('id-ID')} ${item.satuan}` : '-';
            tableRowsHtml += `
                <tr>
                    <td class="text-center text-xs fw-semibold text-muted" style="width: 50px;">${idx + 1}</td>
                    <td class="text-xs text-dark fw-bold" style="max-width: 350px; white-space: normal; word-break: break-word;">
                        <div class="text-xxs text-primary fw-semibold">${item.kode}</div>
                        <div>${item.name}</div>
                        <div class="text-xxs text-muted fw-normal mt-1"><i class="bi bi-person me-1"></i> Pelaksana: ${pelaksanaList}</div>
                    </td>
                    <td class="text-xs fw-bold text-dark text-end" style="width: 140px;">${formatRupiah(item.budget)}</td>
                    <td class="text-xs text-secondary text-end" style="width: 80px;">${pct}</td>
                    <td class="text-xs text-dark text-center" style="width: 130px; white-space: normal; word-break: break-word;">${targetText}</td>
                </tr>
            `;
        });

        const modalBody = document.getElementById('modal-subkeg-details-body');
        if (!modalBody) return;

        const displayYear = state.activeFilters.tahun === 'all' ? 'Semua Tahun' : `Tahun ${state.activeFilters.tahun}`;
        const displayJenis = state.activeFilters.jenisAnggaran === 'all' ? 'Semua Versi Anggaran' : state.activeFilters.jenisAnggaran;

        // Set Title
        document.getElementById('subkegDetailsModalLabel').innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-list-stars fs-5 text-primary"></i>
                <div>
                    <div class="fw-bold text-dark text-xs text-uppercase" style="letter-spacing: 0.05em;">Rincian Alokasi Semua Subkegiatan</div>
                    <div class="text-muted text-xxs fw-normal">${displayYear} &bull; ${displayJenis}</div>
                </div>
            </div>
        `;

        // Set Body HTML
        modalBody.innerHTML = `
            <div class="bg-light-subtle border rounded p-3 mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Anggaran Belanja (Aktif)</div>
                    <div class="text-sm fw-bold text-primary">${formatRupiah(totalBudget)}</div>
                </div>
                <div class="text-end">
                    <div class="text-xxs text-muted text-uppercase fw-semibold">Total Item Subkegiatan (Aktif)</div>
                    <div class="text-xs fw-bold text-dark">${sortedList.length} Subkegiatan</div>
                </div>
            </div>

            <div class="table-responsive border rounded bg-white" style="max-height: 480px; overflow-y: auto;">
                <table class="table table-sm table-hover mb-0 align-middle">
                    <thead class="table-light sticky-top" style="z-index: 1;">
                        <tr>
                            <th class="text-center text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 50px;">No</th>
                            <th class="text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem;">Subkegiatan</th>
                            <th class="text-end text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 140px;">Total Anggaran</th>
                            <th class="text-end text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 80px;">Porsi (%)</th>
                            <th class="text-center text-xxs fw-bold text-secondary text-uppercase py-2.5" style="font-size: 0.6rem; width: 130px;">Target Gabungan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || `<tr><td colspan="5" class="text-center text-muted py-4 text-xs">Tidak ada data subkegiatan</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        const myModal = new bootstrap.Modal(document.getElementById('subkegDetailsModal'));
        myModal.show();
    }

    function renderRealisasiTab() {
        const data = state.filteredData;
        
        // Filter rows that fall within the active definitive budget scope (P-APBD if all, or selected jenisAnggaran)
        const scopeRows = data.filter(row => isRowInActiveSummaryScope(row));
        
        // Filter rows that have realisasi > 0 or anggaran > 0
        const realisasiRows = scopeRows.filter(row => (row.realisasi > 0 || row.anggaran > 0));
        
        // Get elements
        const elKpiBudget = document.getElementById('realisasi-kpi-budget');
        const elKpiAmount = document.getElementById('realisasi-kpi-amount');
        const elKpiRate = document.getElementById('realisasi-kpi-rate');
        const elKpiRemaining = document.getElementById('realisasi-kpi-remaining');
        
        const elCountBidang = document.getElementById('realisasi-count-bidang');
        const elTableBidang = document.getElementById('realisasi-table-bidang');
        const elCountProgram = document.getElementById('realisasi-count-program');
        const elTableProgram = document.getElementById('realisasi-table-program');
        
        if (!elKpiBudget && !elTableBidang) return; // Prevent errors if elements not present
        
        const elYearBadge = document.getElementById('realisasi-active-year-badge');
        if (elYearBadge) {
            const activeYear = state.activeFilters.tahun === 'all' ? 'Semua Tahun' : `Tahun ${state.activeFilters.tahun}`;
            let activeJenis = state.activeFilters.jenisAnggaran;
            if (activeJenis === 'all') {
                if (state.activeFilters.tahun === '2026') {
                    activeJenis = 'APBD Murni';
                } else if (state.activeFilters.tahun === 'all') {
                    activeJenis = 'P-APBD & APBD (2026)';
                } else {
                    activeJenis = 'P-APBD (Perubahan)';
                }
            }
            elYearBadge.innerHTML = `<i class="bi bi-calendar3 me-1.5"></i> ${activeYear} &bull; ${activeJenis}`;
        }
        
        // Subtitle under TOTAL ANGGARAN card
        const elBudgetSub = document.getElementById('realisasi-kpi-budget-sub');
        if (elBudgetSub) {
            if (state.activeFilters.jenisAnggaran === 'all') {
                if (state.activeFilters.tahun === '2026') {
                    elBudgetSub.textContent = 'Berdasarkan APBD Murni';
                } else if (state.activeFilters.tahun === 'all') {
                    elBudgetSub.textContent = 'Berdasarkan P-APBD & APBD (2026)';
                } else {
                    elBudgetSub.textContent = 'Pagu anggaran P-APBD (Perubahan)';
                }
            } else {
                elBudgetSub.textContent = `Pagu anggaran ${state.activeFilters.jenisAnggaran}`;
            }
        }
        
        // Calculate totals based on active scope rows
        const totalBudget = scopeRows.reduce((sum, r) => sum + (r.anggaran || 0), 0);
        const totalRealisasi = scopeRows.reduce((sum, r) => sum + (r.realisasi || 0), 0);
        const totalRemaining = Math.max(0, totalBudget - totalRealisasi);
        const rate = totalBudget > 0 ? Math.min(100, (totalRealisasi / totalBudget * 100)) : 0;
        
        if (totalBudget === 0 && totalRealisasi === 0) {
            // No realisasi data under active filters
            if (elKpiBudget) elKpiBudget.textContent = 'Rp 0';
            if (elKpiAmount) elKpiAmount.textContent = 'Rp 0';
            if (elKpiRate) elKpiRate.textContent = '0.00%';
            if (elKpiRemaining) elKpiRemaining.textContent = 'Rp 0';
            
            if (elCountBidang) elCountBidang.textContent = '0 Unit';
            if (elTableBidang) elTableBidang.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4 text-xs">Tidak ada data realisasi untuk filter aktif.</td></tr>`;
            if (elCountProgram) elCountProgram.textContent = '0 Program';
            if (elTableProgram) elTableProgram.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4 text-xs">Tidak ada data realisasi untuk filter aktif.</td></tr>`;
            return;
        }
        
        // Update KPIs
        if (elKpiBudget) animateValue(elKpiBudget, totalBudget, true);
        if (elKpiAmount) animateValue(elKpiAmount, totalRealisasi, true);
        if (elKpiRate) elKpiRate.textContent = `${rate.toFixed(2)}%`;
        if (elKpiRemaining) animateValue(elKpiRemaining, totalRemaining, true);
        
        // Group by UPT/Bidang
        const bidangGroups = {};
        realisasiRows.forEach(r => {
            const key = r.bidangUpt || 'Dinas (Kantor Pusat)';
            if (!bidangGroups[key]) {
                bidangGroups[key] = { budget: 0, realisasi: 0 };
            }
            bidangGroups[key].budget += r.anggaran || 0;
            bidangGroups[key].realisasi += r.realisasi || 0;
        });
        
        const sortedBidangs = Object.keys(bidangGroups).map(name => {
            const b = bidangGroups[name];
            const pct = b.budget > 0 ? Math.min(100, (b.realisasi / b.budget * 100)) : 0;
            return { name, budget: b.budget, realisasi: b.realisasi, pct };
        }).sort((x, y) => y.pct - x.pct); // Order by highest absorption rate
        
        elCountBidang.textContent = `${sortedBidangs.length} Unit`;
        elTableBidang.innerHTML = '';
        sortedBidangs.forEach(b => {
            const pctText = b.pct.toFixed(2);
            let barColor = 'bg-success';
            let statusText = 'Tinggi (Sangat Baik)';
            if (b.pct < 75) {
                barColor = 'bg-danger';
                statusText = 'Rendah (Butuh Evaluasi)';
            } else if (b.pct < 90) {
                barColor = 'bg-warning';
                statusText = 'Sedang (Cukup)';
            }
            const tr = document.createElement('tr');
            tr.className = 'clickable-row-item';
            tr.innerHTML = `
                <td class="text-xs fw-semibold text-dark">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-chevron-right me-2 text-muted chevron-icon" style="font-size: 0.75rem; transition: transform 0.15s ease;"></i>
                        <div class="table-item-title flex-grow-1" title="${b.name}">${b.name}</div>
                    </div>
                </td>
                <td class="text-end text-nowrap">
                    <div class="fw-bold text-success text-xs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(b.realisasi)}">
                        ${formatRupiah(b.realisasi)}
                    </div>
                    <div class="text-muted text-xxs mt-0.5" style="font-size: 0.68rem;" title="Pagu Anggaran: ${formatRupiah(b.budget)}">
                        Pagu: ${formatRupiah(b.budget)}
                    </div>
                </td>
                <td data-custom-tooltip="true" data-tooltip-name="${b.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                    <div class="d-flex align-items-center gap-1.5 justify-content-end">
                        <div class="progress flex-grow-1" style="height: 6px; background-color: #e2e8f0; min-width: 45px; max-width: 70px;">
                            <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(b.pct, 100)}%;" aria-valuenow="${b.pct}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <span class="fw-bold text-secondary text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                    </div>
                </td>
            `;
            tr.addEventListener('click', function() {
                toggleBidangRow(this, b.name);
            });
            elTableBidang.appendChild(tr);
        });
        
        // Group by Program
        const programGroups = {};
        realisasiRows.forEach(r => {
            const key = r.program || 'Tanpa Program';
            if (!programGroups[key]) {
                programGroups[key] = { budget: 0, realisasi: 0 };
            }
            programGroups[key].budget += r.anggaran || 0;
            programGroups[key].realisasi += r.realisasi || 0;
        });
        
        const sortedPrograms = Object.keys(programGroups).map(name => {
            const p = programGroups[name];
            const pct = p.budget > 0 ? Math.min(100, (p.realisasi / p.budget * 100)) : 0;
            return { name, budget: p.budget, realisasi: p.realisasi, pct };
        }).sort((x, y) => y.pct - x.pct); // Order by highest absorption rate
        
        elCountProgram.textContent = `${sortedPrograms.length} Program`;
        elTableProgram.innerHTML = '';
        sortedPrograms.forEach(p => {
            const pctText = p.pct.toFixed(2);
            let barColor = 'bg-success';
            let statusText = 'Tinggi (Sangat Baik)';
            if (p.pct < 75) {
                barColor = 'bg-danger';
                statusText = 'Rendah (Butuh Evaluasi)';
            } else if (p.pct < 90) {
                barColor = 'bg-warning';
                statusText = 'Sedang (Cukup)';
            }
            const tr = document.createElement('tr');
            tr.className = 'clickable-row-item';
            tr.setAttribute('data-program-name', p.name);
            tr.innerHTML = `
                <td class="text-xs fw-semibold text-dark">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-chevron-right me-2 text-muted chevron-icon" style="font-size: 0.75rem; transition: transform 0.15s ease;"></i>
                        <div class="table-item-title flex-grow-1" title="${p.name}">${p.name}</div>
                    </div>
                </td>
                <td class="text-end text-nowrap">
                    <div class="fw-bold text-success text-xs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(p.realisasi)}">
                        ${formatRupiah(p.realisasi)}
                    </div>
                    <div class="text-muted text-xxs mt-0.5" style="font-size: 0.68rem;" title="Pagu Anggaran: ${formatRupiah(p.budget)}">
                        Pagu: ${formatRupiah(p.budget)}
                    </div>
                </td>
                <td data-custom-tooltip="true" data-tooltip-name="${p.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                    <div class="d-flex align-items-center gap-1.5 justify-content-end">
                        <div class="progress flex-grow-1" style="height: 6px; background-color: #e2e8f0; min-width: 45px; max-width: 70px;">
                            <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(p.pct, 100)}%;" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <span class="fw-bold text-secondary text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                    </div>
                </td>
            `;
            tr.addEventListener('click', function() {
                toggleProgramRow(this, p.name);
            });
            elTableProgram.appendChild(tr);
        });
    }

    const realisasiTabEl = document.getElementById('realisasi-tab');
    if (realisasiTabEl) {
        realisasiTabEl.addEventListener('shown.bs.tab', function () {
            renderRealisasiTab();
        });
    }

    // Realisasi Inline Expandable Tree Grid
    function toggleProgramRow(rowEl, programName) {
        const isExpanded = rowEl.classList.contains('expanded');
        const chevron = rowEl.querySelector('.chevron-icon');
        const tableBody = rowEl.parentNode;
        
        if (isExpanded) {
            rowEl.classList.remove('expanded');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            
            const children = Array.from(tableBody.children).filter(child => child.getAttribute('data-parent-program') === programName);
            children.forEach(child => child.remove());
        } else {
            rowEl.classList.add('expanded');
            if (chevron) chevron.style.transform = 'rotate(90deg)';
            
            const data = state.filteredData;
            const realisasiRows = data.filter(row => isRowInActiveSummaryScope(row) && row.program === programName);
            
            const groups = {};
            realisasiRows.forEach(r => {
                const key = r.kegiatan || 'Tanpa Kegiatan';
                if (!groups[key]) {
                    groups[key] = { kode: r.kodeKegiatan || '', name: key, budget: 0, realisasi: 0 };
                }
                groups[key].budget += r.anggaran || 0;
                groups[key].realisasi += r.realisasi || 0;
            });
            
            const sortedKegiatans = Object.values(groups).sort((a, b) => b.budget - a.budget);
            
            let lastInserted = rowEl;
            sortedKegiatans.forEach(k => {
                const pct = k.budget > 0 ? Math.min(100, (k.realisasi / k.budget * 100)) : 0;
                const pctText = pct.toFixed(2);
                let barColor = 'bg-success';
                let statusText = 'Tinggi (Sangat Baik)';
                if (pct < 75) {
                    barColor = 'bg-danger';
                    statusText = 'Rendah (Butuh Evaluasi)';
                } else if (pct < 90) {
                    barColor = 'bg-warning';
                    statusText = 'Sedang (Cukup)';
                }
                const ktr = document.createElement('tr');
                ktr.className = 'clickable-row-item bg-light-subtle';
                ktr.setAttribute('data-parent-program', programName);
                ktr.setAttribute('data-kegiatan-name', k.name);
                ktr.innerHTML = `
                    <td class="text-xs text-secondary">
                        <div class="d-flex align-items-center" style="padding-left: 16px;">
                            <i class="bi bi-chevron-right me-1.5 text-muted child-chevron-icon" style="font-size: 0.7rem; transition: transform 0.15s ease;"></i>
                            <div class="table-item-title flex-grow-1" title="${k.name}">
                                <span class="text-xxs text-muted fw-normal">${k.kode}</span> ${k.name}
                            </div>
                        </div>
                    </td>
                    <td class="text-end text-nowrap">
                        <div class="fw-semibold text-success text-xs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(k.realisasi)}">
                            ${formatRupiah(k.realisasi)}
                        </div>
                        <div class="text-muted text-xxs mt-0.5" style="font-size: 0.65rem;" title="Pagu Anggaran: ${formatRupiah(k.budget)}">
                            Pagu: ${formatRupiah(k.budget)}
                        </div>
                    </td>
                    <td data-custom-tooltip="true" data-tooltip-name="${k.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                        <div class="d-flex align-items-center gap-1.5 justify-content-end">
                            <div class="progress flex-grow-1" style="height: 5px; background-color: #e2e8f0; min-width: 45px; max-width: 70px;">
                                <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(pct, 100)}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-secondary text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                        </div>
                    </td>
                </tr>
                `;
                
                ktr.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleKegiatanRow(this, programName, k.name);
                });
                
                lastInserted.after(ktr);
                lastInserted = ktr;
            });
        }
    }

    function toggleKegiatanRow(kegRowEl, programName, kegiatanName) {
        const isExpanded = kegRowEl.classList.contains('expanded');
        const chevron = kegRowEl.querySelector('.child-chevron-icon');
        const tableBody = kegRowEl.parentNode;
        
        if (isExpanded) {
            kegRowEl.classList.remove('expanded');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            
            const children = Array.from(tableBody.children).filter(child => child.getAttribute('data-parent-kegiatan') === kegiatanName);
            children.forEach(child => child.remove());
        } else {
            kegRowEl.classList.add('expanded');
            if (chevron) chevron.style.transform = 'rotate(90deg)';
            
            const data = state.filteredData;
            const realisasiRows = data.filter(row => isRowInActiveSummaryScope(row) && row.program === programName && row.kegiatan === kegiatanName);
            
            const groups = {};
            realisasiRows.forEach(r => {
                const key = r.subkegiatan || 'Tanpa Subkegiatan';
                if (!groups[key]) {
                    groups[key] = { kode: r.kodeSubkegiatan || '', name: key, budget: 0, realisasi: 0 };
                }
                groups[key].budget += r.anggaran || 0;
                groups[key].realisasi += r.realisasi || 0;
            });
            
            const sortedSubkegiatans = Object.values(groups).sort((a, b) => b.budget - a.budget);
            
            let lastInserted = kegRowEl;
            sortedSubkegiatans.forEach(s => {
                const pct = s.budget > 0 ? Math.min(100, (s.realisasi / s.budget * 100)) : 0;
                const pctText = pct.toFixed(2);
                let barColor = 'bg-success';
                let statusText = 'Tinggi (Sangat Baik)';
                if (pct < 75) {
                    barColor = 'bg-danger';
                    statusText = 'Rendah (Butuh Evaluasi)';
                } else if (pct < 90) {
                    barColor = 'bg-warning';
                    statusText = 'Sedang (Cukup)';
                }
                const str = document.createElement('tr');
                str.className = 'bg-body-secondary';
                str.setAttribute('data-parent-program', programName);
                str.setAttribute('data-parent-kegiatan', kegiatanName);
                str.innerHTML = `
                    <td class="text-xs text-muted">
                        <div class="d-flex align-items-center" style="padding-left: 36px; white-space: normal; word-break: break-word;">
                            <i class="bi bi-dot me-1 text-muted"></i>
                            <div class="table-item-title flex-grow-1" title="${s.name}">
                                <span class="text-xxs text-muted fw-normal">${s.kode}</span> ${s.name}
                            </div>
                        </div>
                    </td>
                    <td class="text-end text-nowrap">
                        <div class="fw-semibold text-success text-xxs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(s.realisasi)}">
                            ${formatRupiah(s.realisasi)}
                        </div>
                        <div class="text-muted text-xxs mt-0.5" style="font-size: 0.62rem;" title="Pagu Anggaran: ${formatRupiah(s.budget)}">
                            Pagu: ${formatRupiah(s.budget)}
                        </div>
                    </td>
                    <td data-custom-tooltip="true" data-tooltip-name="${s.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                        <div class="d-flex align-items-center gap-1.5 justify-content-end">
                            <div class="progress flex-grow-1" style="height: 4px; background-color: #e2e8f0; min-width: 45px; max-width: 70px;">
                                <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(pct, 100)}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-muted text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                        </div>
                    </td>
                </tr>
                `;
                
                str.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
                
                lastInserted.after(str);
                lastInserted = str;
            });
        }
    }

    // Custom Elegant Tooltip Logic
    function updateTooltipPosition(event, tooltip) {
        tooltip.classList.remove('tooltip-left');
        const w = tooltip.offsetWidth;
        const h = tooltip.offsetHeight;
        
        let leftPos = event.pageX + 18;
        if (event.clientX + 18 + w > window.innerWidth) {
            leftPos = event.pageX - w - 18;
            tooltip.classList.add('tooltip-left');
        }
        
        tooltip.style.left = leftPos + 'px';
        tooltip.style.top = (event.pageY - (h / 2)) + 'px';
    }

    function showCustomTooltip(pct, status, event, element) {
        let tooltip = document.getElementById('custom-elegant-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'custom-elegant-tooltip';
            tooltip.className = 'custom-elegant-tooltip-box';
            document.body.appendChild(tooltip);
        }
        
        const name = element.getAttribute('data-tooltip-name') || 'Kinerja Penyerapan';
        
        let color = '#10b981'; // emerald green
        if (status.includes('Rendah')) {
            color = '#f43f5e'; // rose red
        } else if (status.includes('Sedang')) {
            color = '#f59e0b'; // amber yellow
        }
        
        tooltip.innerHTML = `
            <div class="custom-tooltip-header text-truncate" style="padding: 6px 12px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #64748b; font-weight: 600; max-width: 300px; border-radius: 7px 7px 0 0;">
                ${name}
            </div>
            <div class="custom-tooltip-body d-flex align-items-center gap-2" style="padding: 10px 12px; background-color: #fff; font-size: 12px; border-radius: 0 0 7px 7px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>
                <span style="color: #64748b; font-weight: 500;">Penyerapan:</span>
                <strong style="color: #1e293b; font-weight: 700;">${pct}%</strong>
                <span class="badge" style="background-color: ${color}15; color: ${color}; border: 1px solid ${color}30; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: auto;">${status.split(' ')[0]}</span>
            </div>
        `;
        
        tooltip.style.display = 'block';
        updateTooltipPosition(event, tooltip);
        
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
        });
    }

    function hideCustomTooltip() {
        const tooltip = document.getElementById('custom-elegant-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.display = 'none';
        }
    }

    // Set up global tooltip listeners
    document.addEventListener('mouseover', function(e) {
        const target = e.target.closest('[data-custom-tooltip]');
        if (target) {
            const pct = target.getAttribute('data-tooltip-pct');
            const status = target.getAttribute('data-tooltip-status');
            showCustomTooltip(pct, status, e, target);
        }
    });

    document.addEventListener('mouseout', function(e) {
        const target = e.target.closest('[data-custom-tooltip]');
        if (target) {
            hideCustomTooltip();
        }
    });

    document.addEventListener('mousemove', function(e) {
        const tooltip = document.getElementById('custom-elegant-tooltip');
        if (tooltip && tooltip.style.display !== 'none') {
            updateTooltipPosition(e, tooltip);
        }
    });

    // UPT/Bidang Inline Expandable Tree Grid
    function toggleBidangRow(rowEl, bidangName) {
        const isExpanded = rowEl.classList.contains('expanded');
        const chevron = rowEl.querySelector('.chevron-icon');
        const tableBody = rowEl.parentNode;
        
        if (isExpanded) {
            rowEl.classList.remove('expanded');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            
            const children = Array.from(tableBody.children).filter(child => child.getAttribute('data-parent-bidang') === bidangName);
            children.forEach(child => child.remove());
        } else {
            rowEl.classList.add('expanded');
            if (chevron) chevron.style.transform = 'rotate(90deg)';
            
            const data = state.filteredData;
            const realisasiRows = data.filter(row => isRowInActiveSummaryScope(row) && row.bidangUpt === bidangName);
            
            const groups = {};
            realisasiRows.forEach(r => {
                const key = r.program || 'Tanpa Program';
                if (!groups[key]) {
                    groups[key] = { name: key, budget: 0, realisasi: 0 };
                }
                groups[key].budget += r.anggaran || 0;
                groups[key].realisasi += r.realisasi || 0;
            });
            
            const sortedPrograms = Object.keys(groups).map(name => {
                const p = groups[name];
                const pct = p.budget > 0 ? Math.min(100, (p.realisasi / p.budget * 100)) : 0;
                return { name, budget: p.budget, realisasi: p.realisasi, pct };
            }).sort((x, y) => y.pct - x.pct);
            
            let lastInserted = rowEl;
            sortedPrograms.forEach(p => {
                const pctText = p.pct.toFixed(2);
                let barColor = 'bg-success';
                let statusText = 'Tinggi (Sangat Baik)';
                if (p.pct < 75) {
                    barColor = 'bg-danger';
                    statusText = 'Rendah (Butuh Evaluasi)';
                } else if (p.pct < 90) {
                    barColor = 'bg-warning';
                    statusText = 'Sedang (Cukup)';
                }
                
                const ptr = document.createElement('tr');
                ptr.className = 'clickable-row-item bg-light-subtle';
                ptr.setAttribute('data-parent-bidang', bidangName);
                ptr.setAttribute('data-parent-program', p.name);
                ptr.innerHTML = `
                    <td class="text-xs text-secondary">
                        <div class="d-flex align-items-center" style="padding-left: 16px;">
                            <i class="bi bi-chevron-right me-1.5 text-muted child-chevron-icon" style="font-size: 0.7rem; transition: transform 0.15s ease;"></i>
                            <div class="table-item-title flex-grow-1" title="${p.name}">${p.name}</div>
                        </div>
                    </td>
                    <td class="text-end text-nowrap">
                        <div class="fw-semibold text-success text-xs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(p.realisasi)}">
                            ${formatRupiah(p.realisasi)}
                        </div>
                        <div class="text-muted text-xxs mt-0.5" style="font-size: 0.65rem;" title="Pagu Anggaran: ${formatRupiah(p.budget)}">
                            Pagu: ${formatRupiah(p.budget)}
                        </div>
                    </td>
                    <td data-custom-tooltip="true" data-tooltip-name="${p.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                        <div class="d-flex align-items-center gap-1.5 justify-content-end">
                            <div class="progress flex-grow-1" style="height: 5px; background-color: #cbd5e1; min-width: 45px; max-width: 70px;">
                                <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(p.pct, 100)}%;" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-secondary text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                        </div>
                    </td>
                </tr>
                `;
                
                ptr.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleBidangProgramRow(this, bidangName, p.name);
                });
                
                lastInserted.after(ptr);
                lastInserted = ptr;
            });
        }
    }

    function toggleBidangProgramRow(rowEl, bidangName, programName) {
        const isExpanded = rowEl.classList.contains('expanded');
        const chevron = rowEl.querySelector('.child-chevron-icon');
        const tableBody = rowEl.parentNode;
        
        if (isExpanded) {
            rowEl.classList.remove('expanded');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            
            const children = Array.from(tableBody.children).filter(child => 
                child.getAttribute('data-parent-bidang') === bidangName && 
                child.getAttribute('data-parent-program') === programName && 
                child.hasAttribute('data-kegiatan-name')
            );
            children.forEach(child => child.remove());
        } else {
            rowEl.classList.add('expanded');
            if (chevron) chevron.style.transform = 'rotate(90deg)';
            
            const data = state.filteredData;
            const realisasiRows = data.filter(row => isRowInActiveSummaryScope(row) && row.bidangUpt === bidangName && row.program === programName);
            
            const groups = {};
            realisasiRows.forEach(r => {
                const key = r.kegiatan || 'Tanpa Kegiatan';
                if (!groups[key]) {
                    groups[key] = { kode: r.kodeKegiatan || '', name: key, budget: 0, realisasi: 0 };
                }
                groups[key].budget += r.anggaran || 0;
                groups[key].realisasi += r.realisasi || 0;
            });
            
            const sortedKegiatans = Object.values(groups).sort((a, b) => b.budget - a.budget);
            
            let lastInserted = rowEl;
            sortedKegiatans.forEach(k => {
                const pct = k.budget > 0 ? Math.min(100, (k.realisasi / k.budget * 100)) : 0;
                const pctText = pct.toFixed(2);
                let barColor = 'bg-success';
                let statusText = 'Tinggi (Sangat Baik)';
                if (pct < 75) {
                    barColor = 'bg-danger';
                    statusText = 'Rendah (Butuh Evaluasi)';
                } else if (pct < 90) {
                    barColor = 'bg-warning';
                    statusText = 'Sedang (Cukup)';
                }
                
                const ktr = document.createElement('tr');
                ktr.className = 'clickable-row-item bg-body-secondary';
                ktr.setAttribute('data-parent-bidang', bidangName);
                ktr.setAttribute('data-parent-program', programName);
                ktr.setAttribute('data-kegiatan-name', k.name);
                ktr.innerHTML = `
                    <td class="text-xs text-secondary">
                        <div class="d-flex align-items-center" style="padding-left: 32px;">
                            <i class="bi bi-chevron-right me-1.5 text-muted sub-child-chevron-icon" style="font-size: 0.65rem; transition: transform 0.15s ease;"></i>
                            <div class="table-item-title flex-grow-1" title="${k.name}">
                                <span class="text-xxs text-muted fw-normal">${k.kode}</span> ${k.name}
                            </div>
                        </div>
                    </td>
                    <td class="text-end text-nowrap">
                        <div class="fw-semibold text-success text-xs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(k.realisasi)}">
                            ${formatRupiah(k.realisasi)}
                        </div>
                        <div class="text-muted text-xxs mt-0.5" style="font-size: 0.65rem;" title="Pagu Anggaran: ${formatRupiah(k.budget)}">
                            Pagu: ${formatRupiah(k.budget)}
                        </div>
                    </td>
                    <td data-custom-tooltip="true" data-tooltip-name="${k.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                        <div class="d-flex align-items-center gap-1.5 justify-content-end">
                            <div class="progress flex-grow-1" style="height: 5px; background-color: #cbd5e1; min-width: 45px; max-width: 70px;">
                                <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(pct, 100)}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-secondary text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                        </div>
                    </td>
                </tr>
                `;
                
                ktr.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleBidangKegiatanRow(this, bidangName, programName, k.name);
                });
                
                lastInserted.after(ktr);
                lastInserted = ktr;
            });
        }
    }

    function toggleBidangKegiatanRow(rowEl, bidangName, programName, kegiatanName) {
        const isExpanded = rowEl.classList.contains('expanded');
        const chevron = rowEl.querySelector('.sub-child-chevron-icon');
        const tableBody = rowEl.parentNode;
        
        if (isExpanded) {
            rowEl.classList.remove('expanded');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            
            const children = Array.from(tableBody.children).filter(child => 
                child.getAttribute('data-parent-bidang') === bidangName && 
                child.getAttribute('data-parent-program') === programName && 
                child.getAttribute('data-parent-kegiatan') === kegiatanName
            );
            children.forEach(child => child.remove());
        } else {
            rowEl.classList.add('expanded');
            if (chevron) chevron.style.transform = 'rotate(90deg)';
            
            const data = state.filteredData;
            const realisasiRows = data.filter(row => 
                isRowInActiveSummaryScope(row) && 
                row.bidangUpt === bidangName && 
                row.program === programName && 
                row.kegiatan === kegiatanName
            );
            
            const groups = {};
            realisasiRows.forEach(r => {
                const key = r.subkegiatan || 'Tanpa Subkegiatan';
                if (!groups[key]) {
                    groups[key] = { kode: r.kodeSubkegiatan || '', name: key, budget: 0, realisasi: 0 };
                }
                groups[key].budget += r.anggaran || 0;
                groups[key].realisasi += r.realisasi || 0;
            });
            
            const sortedSubkegiatans = Object.values(groups).sort((a, b) => b.budget - a.budget);
            
            let lastInserted = rowEl;
            sortedSubkegiatans.forEach(s => {
                const pct = s.budget > 0 ? Math.min(100, (s.realisasi / s.budget * 100)) : 0;
                const pctText = pct.toFixed(2);
                let barColor = 'bg-success';
                let statusText = 'Tinggi (Sangat Baik)';
                if (pct < 75) {
                    barColor = 'bg-danger';
                    statusText = 'Rendah (Butuh Evaluasi)';
                } else if (pct < 90) {
                    barColor = 'bg-warning';
                    statusText = 'Sedang (Cukup)';
                }
                
                const str = document.createElement('tr');
                str.className = 'bg-body-secondary opacity-75';
                str.setAttribute('data-parent-bidang', bidangName);
                str.setAttribute('data-parent-program', programName);
                str.setAttribute('data-parent-kegiatan', kegiatanName);
                str.innerHTML = `
                    <td class="text-xs text-muted">
                        <div class="d-flex align-items-center" style="padding-left: 48px; white-space: normal; word-break: break-word;">
                            <i class="bi bi-dot me-1 text-muted"></i>
                            <div class="table-item-title flex-grow-1" title="${s.name}">
                                <span class="text-xxs text-muted fw-normal">${s.kode}</span> ${s.name}
                            </div>
                        </div>
                    </td>
                    <td class="text-end text-nowrap">
                        <div class="fw-semibold text-success text-xxs" style="color: #059669 !important;" title="Realisasi: ${formatRupiah(s.realisasi)}">
                            ${formatRupiah(s.realisasi)}
                        </div>
                        <div class="text-muted text-xxs mt-0.5" style="font-size: 0.62rem;" title="Pagu Anggaran: ${formatRupiah(s.budget)}">
                            Pagu: ${formatRupiah(s.budget)}
                        </div>
                    </td>
                    <td data-custom-tooltip="true" data-tooltip-name="${s.name}" data-tooltip-pct="${pctText}" data-tooltip-status="${statusText}">
                        <div class="d-flex align-items-center gap-1.5 justify-content-end">
                            <div class="progress flex-grow-1" style="height: 4px; background-color: #cbd5e1; min-width: 45px; max-width: 70px;">
                                <div class="progress-bar ${barColor}" role="progressbar" style="width: ${Math.min(pct, 100)}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-muted text-xxs text-nowrap" style="min-width: 42px; text-align: right;">${pctText}%</span>
                        </div>
                    </td>
                </tr>
                `;
                
                str.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
                
                lastInserted.after(str);
                lastInserted = str;
            });
        }
    }

    // Mobile Sidebar Toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const appSidebar = document.getElementById('appSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (sidebarToggleBtn && appSidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            appSidebar.classList.toggle('show');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('show');
        });
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                appSidebar.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            });
        }
        document.querySelectorAll('.sidebar-menu-btn:not([data-bs-toggle="collapse"]), .sidebar-submenu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth < 992 && appSidebar) {
                    appSidebar.classList.remove('show');
                    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
                }
            });
        });
    }

    // Ringkasan Card Quick Nav Buttons
    const btnGotoRealisasiList = document.querySelectorAll('.btn-goto-realisasi, #btn-goto-realisasi');
    const btnGotoInsights = document.getElementById('btn-goto-insights');
    const insightsTabBtn = document.getElementById('insights-tab');

    if (btnGotoRealisasiList.length > 0) {
        btnGotoRealisasiList.forEach(btn => {
            btn.addEventListener('click', () => {
                const anggaranRealisasiTab = document.getElementById('anggaran-realisasi-tab');
                if (anggaranRealisasiTab) {
                    const tabTrigger = bootstrap.Tab.getOrCreateInstance(anggaranRealisasiTab);
                    tabTrigger.show();
                    const submenuAnggaran = document.getElementById('submenu-anggaran');
                    if (submenuAnggaran && !submenuAnggaran.classList.contains('show')) {
                        const collapseObj = bootstrap.Collapse.getOrCreateInstance(submenuAnggaran);
                        collapseObj.show();
                    }
                }
            });
        });
    }
    if (btnGotoInsights && insightsTabBtn) {
        btnGotoInsights.addEventListener('click', () => {
            insightsTabBtn.click();
        });
    }

    // =========================================================================
    // 14. TARGET KINERJA & HIERARKI KINERJA MODULE (Matching Reference Mockup & Excel Kinerja_Tujuan)
    // =========================================================================
    const KINERJA_HIERARCHY_DATA = {
        tujuan: {
            levelName: 'Tujuan',
            title: 'Tujuan',
            desc: 'Meningkatkan Kualitas dan Konektivitas Infrastruktur Jalan dan Jembatan Provinsi Jawa Timur',
            icon: 'bi-bullseye',
            iconBg: 'bg-blue-subtle text-primary',
            metrics: {
                jumlahIndikator: 1,
                rataTarget: 73.83,
                rataRealisasi: 78.04,
                rataTargetText: '0,738',
                rataRealisasiText: '0,780',
                capaianKinerja: 106.60,
                capaianKinerjaText: '106,60%',
                statusText: 'Melebihi Target',
                statusDiff: '+6,60%',
                kategoriText: 'Sangat Baik'
            },
            chartData: {
                labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
                targets: [0.695, 0.699, 0.704, 0.848, 0.826, 0.627, 0.769, 0.636, 0.642, 0.647, 0.653, 0.659, 0.665],
                realisasis: [0.713, 0.758, 0.707, 0.810, 0.825, 0.841, 0.809, 0.636, null, null, null, null, null],
                capaians: [102.59, 108.44, 100.43, 95.52, 99.88, 134.13, 105.20, 100.00, null, null, null, null, null]
            },
            tableData: [
                { no: 1, name: 'Indeks Konektivitas', tahun: '2019', satuan: 'Indeks', target: '0,695', realisasi: '0,713', capaian: '102,59%', status: 'Melebihi Target' },
                { no: 2, name: 'Indeks Konektivitas', tahun: '2020', satuan: 'Indeks', target: '0,699', realisasi: '0,758', capaian: '108,44%', status: 'Melebihi Target' },
                { no: 3, name: 'Indeks Konektivitas', tahun: '2021', satuan: 'Indeks', target: '0,704', realisasi: '0,707', capaian: '100,43%', status: 'Melebihi Target' },
                { no: 4, name: 'Indeks Konektivitas', tahun: '2022', satuan: 'Indeks', target: '0,848', realisasi: '0,810', capaian: '95,52%', status: 'Tidak Tercapai' },
                { no: 5, name: 'Indeks Konektivitas', tahun: '2023', satuan: 'Indeks', target: '0,826', realisasi: '0,825', capaian: '99,88%', status: 'Tidak Tercapai' },
                { no: 6, name: 'Indeks Konektivitas', tahun: '2024', satuan: 'Indeks', target: '0,627', realisasi: '0,841', capaian: '134,13%', status: 'Melebihi Target' },
                { no: 7, name: 'Indeks Kinerja Jalan', tahun: '2025 (RPD)', satuan: 'Indeks', target: '0,769', realisasi: '0,809', capaian: '105,20%', status: 'Melebihi Target' },
                { no: 8, name: 'Indeks Kinerja Jalan', tahun: '2025', satuan: 'Indeks', target: '0,636', realisasi: '0,636', capaian: '100,00%', status: 'Tercapai' },
                { no: 9, name: 'Indeks Kinerja Jalan', tahun: '2026', satuan: 'Indeks', target: '0,642', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                { no: 10, name: 'Indeks Kinerja Jalan', tahun: '2027', satuan: 'Indeks', target: '0,647', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                { no: 11, name: 'Indeks Kinerja Jalan', tahun: '2028', satuan: 'Indeks', target: '0,653', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                { no: 12, name: 'Indeks Kinerja Jalan', tahun: '2029', satuan: 'Indeks', target: '0,659', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                { no: 13, name: 'Indeks Kinerja Jalan', tahun: '2030', satuan: 'Indeks', target: '0,665', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' }
            ]
        },
        sasaran: {
            levelName: 'Sasaran',
            title: 'Sasaran',
            desc: 'Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akuntabilitas Kinerja Perangkat Daerah',
            icon: 'bi-flag-fill',
            iconBg: 'bg-emerald-subtle text-success',
            metrics: {
                jumlahIndikator: 53,
                rataTarget: 76.58,
                rataRealisasi: 77.40,
                rataTargetText: '76,58%',
                rataRealisasiText: '77,40%',
                capaianKinerja: 101.72,
                capaianKinerjaText: '101,72%',
                statusText: 'Melebihi Target',
                statusDiff: '+1,72%',
                kategoriText: 'Sangat Baik'
            },
            chartData: {
                labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
                targets: [71.03, 71.76, 72.39, 86.76, 86.14, 86.16, 78.86, 73.67, 74.03, 74.41, 74.79, 75.18, 75.56],
                realisasis: [72.79, 77.61, 72.46, 83.02, 84.47, 85.95, 82.59, 74.68, null, null, null, null, null],
                capaians: [106.71, 122.91, 103.02, 96.02, 98.19, 99.90, 105.97, 101.18, null, null, null, null, null]
            },
            tableData: [
          {
                    "no": 1,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2019",
                    "satuan": "Nilai",
                    "target": "84,48",
                    "targetVal": 84.48,
                    "realisasi": "84,48",
                    "realisasiVal": 84.48,
                    "capaian": "100,00%",
                    "capaianVal": 100.00,
                    "status": "Tercapai"
          },
          {
                    "no": 2,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Konektivitas",
                    "tahun": "2019",
                    "satuan": "%",
                    "target": "93,00%",
                    "targetVal": 93,
                    "realisasi": "93,00%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 93,
                    "capaianVal": 100
          },
          {
                    "no": 3,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Presentase Jalan Provinsi yang Memenuhi Tingkat Pelayanan/Level of Service (LoS) minimal B",
                    "tahun": "2019",
                    "satuan": "%",
                    "target": "24,09%",
                    "targetVal": 24.09,
                    "realisasi": "32,90%",
                    "capaian": "136,57%",
                    "status": "Melebihi Target",
                    "realisasiVal": 32.9,
                    "capaianVal": 136.57
          },
          {
                    "no": 4,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2019",
                    "satuan": "%",
                    "target": "91,77%",
                    "targetVal": 91.77,
                    "realisasi": "91,77%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 91.77,
                    "capaianVal": 100
          },
          {
                    "no": 5,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2019",
                    "satuan": "%",
                    "target": "61,82%",
                    "targetVal": 61.82,
                    "realisasi": "61,82%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 61.82,
                    "capaianVal": 100
          },
          {
                    "no": 6,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2020",
                    "satuan": "Nilai",
                    "target": "86,28",
                    "targetVal": 86.28,
                    "realisasi": "84,91",
                    "realisasiVal": 84.91,
                    "capaian": "98,41%",
                    "capaianVal": 98.41,
                    "status": "Tidak Tercapai"
          },
          {
                    "no": 7,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Konektivitas",
                    "tahun": "2020",
                    "satuan": "%",
                    "target": "93,00%",
                    "targetVal": 93,
                    "realisasi": "93,00%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 93,
                    "capaianVal": 100
          },
          {
                    "no": 8,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Presentase Jalan Provinsi yang Memenuhi Tingkat Pelayanan/Level of Service (LoS) minimal B",
                    "tahun": "2020",
                    "satuan": "%",
                    "target": "25,28%",
                    "targetVal": 25.28,
                    "realisasi": "54,54%",
                    "capaian": "215,74%",
                    "status": "Melebihi Target",
                    "realisasiVal": 54.54,
                    "capaianVal": 215.74
          },
          {
                    "no": 9,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2020",
                    "satuan": "%",
                    "target": "91,77%",
                    "targetVal": 91.77,
                    "realisasi": "91,77%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 91.77,
                    "capaianVal": 100
          },
          {
                    "no": 10,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2020",
                    "satuan": "%",
                    "target": "62,45%",
                    "targetVal": 62.45,
                    "realisasi": "62,45%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 62.45,
                    "capaianVal": 100
          },
          {
                    "no": 11,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2021",
                    "satuan": "Nilai",
                    "target": "87,18",
                    "targetVal": 87.18,
                    "realisasi": "84,95",
                    "realisasiVal": 84.95,
                    "capaian": "97,44%",
                    "capaianVal": 97.44,
                    "status": "Tidak Tercapai"
          },
          {
                    "no": 12,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial",
                    "name": "Konektivitas",
                    "tahun": "2021",
                    "satuan": "%",
                    "target": "93,00%",
                    "targetVal": 93,
                    "realisasi": "93,00%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 93,
                    "capaianVal": 100
          },
          {
                    "no": 13,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Presentase Jalan Provinsi yang Memenuhi Tingkat Pelayanan/Level of Service (LoS) minimal B",
                    "tahun": "2021",
                    "satuan": "%",
                    "target": "26,52%",
                    "targetVal": 26.52,
                    "realisasi": "29,10%",
                    "capaian": "109,73%",
                    "status": "Melebihi Target",
                    "realisasiVal": 29.1,
                    "capaianVal": 109.73
          },
          {
                    "no": 14,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2021",
                    "satuan": "%",
                    "target": "92,09%",
                    "targetVal": 92.09,
                    "realisasi": "92,09%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 92.09,
                    "capaianVal": 100
          },
          {
                    "no": 15,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2021",
                    "satuan": "%",
                    "target": "63,14%",
                    "targetVal": 63.14,
                    "realisasi": "63,14%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 63.14,
                    "capaianVal": 100
          },
          {
                    "no": 16,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2022",
                    "satuan": "Nilai",
                    "target": "88,10",
                    "targetVal": 88.1,
                    "realisasi": "85,78",
                    "realisasiVal": 85.78,
                    "capaian": "97,37%",
                    "capaianVal": 97.37,
                    "status": "Tidak Tercapai"
          },
          {
                    "no": 17,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Konektivitas",
                    "tahun": "2022",
                    "satuan": "%",
                    "target": "100,00%",
                    "targetVal": 100,
                    "realisasi": "100,00%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 100,
                    "capaianVal": 100
          },
          {
                    "no": 18,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang Tingkat Pelayanannya (Rasio Volume Kapasitas/RVK) di bawah 0,75",
                    "tahun": "2022",
                    "satuan": "%",
                    "target": "89,51%",
                    "targetVal": 89.51,
                    "realisasi": "84,66%",
                    "capaian": "94,58%",
                    "status": "Tidak Tercapai",
                    "realisasiVal": 84.66,
                    "capaianVal": 94.58
          },
          {
                    "no": 19,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2022",
                    "satuan": "%",
                    "target": "93,66%",
                    "targetVal": 93.66,
                    "realisasi": "89,10%",
                    "capaian": "95,13%",
                    "status": "Tidak Tercapai",
                    "realisasiVal": 89.1,
                    "capaianVal": 95.13
          },
          {
                    "no": 20,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2022",
                    "satuan": "%",
                    "target": "62,55%",
                    "targetVal": 62.55,
                    "realisasi": "62,57%",
                    "capaian": "100,03%",
                    "status": "Tercapai",
                    "realisasiVal": 62.57,
                    "capaianVal": 100.03
          },
          {
                    "no": 21,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2023",
                    "satuan": "Nilai",
                    "target": "85,00",
                    "targetVal": 85,
                    "realisasi": "85,83",
                    "realisasiVal": 85.83,
                    "capaian": "100,98%",
                    "capaianVal": 100.98,
                    "status": "Melebihi Target"
          },
          {
                    "no": 22,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Konektivitas",
                    "tahun": "2023",
                    "satuan": "%",
                    "target": "100,00%",
                    "targetVal": 100,
                    "realisasi": "100,00%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 100,
                    "capaianVal": 100
          },
          {
                    "no": 23,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang Tingkat Pelayanannya (Rasio Volume Kapasitas/RVK) di bawah 0,75",
                    "tahun": "2023",
                    "satuan": "%",
                    "target": "89,51%",
                    "targetVal": 89.51,
                    "realisasi": "86,50%",
                    "capaian": "96,64%",
                    "status": "Tidak Tercapai",
                    "realisasiVal": 86.5,
                    "capaianVal": 96.64
          },
          {
                    "no": 24,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2023",
                    "satuan": "%",
                    "target": "93,66%",
                    "targetVal": 93.66,
                    "realisasi": "89,50%",
                    "capaian": "95,56%",
                    "status": "Tidak Tercapai",
                    "realisasiVal": 89.5,
                    "capaianVal": 95.56
          },
          {
                    "no": 25,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2023",
                    "satuan": "%",
                    "target": "62,55%",
                    "targetVal": 62.55,
                    "realisasi": "60,52%",
                    "capaian": "96,75%",
                    "status": "Tidak Tercapai",
                    "realisasiVal": 60.52,
                    "capaianVal": 96.75
          },
          {
                    "no": 26,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2024",
                    "satuan": "Nilai",
                    "target": "85,10",
                    "targetVal": 85.1,
                    "realisasi": "85,88",
                    "realisasiVal": 85.88,
                    "capaian": "100,92%",
                    "capaianVal": 100.92,
                    "status": "Melebihi Target"
          },
          {
                    "no": 27,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Konektivitas",
                    "tahun": "2024",
                    "satuan": "%",
                    "target": "100,00%",
                    "targetVal": 100,
                    "realisasi": "100,00%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 100,
                    "capaianVal": 100
          },
          {
                    "no": 28,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang Tingkat Pelayanannya (Rasio Volume Kapasitas/RVK) di bawah 0,75",
                    "tahun": "2024",
                    "satuan": "%",
                    "target": "89,51%",
                    "targetVal": 89.51,
                    "realisasi": "89,51%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 89.51,
                    "capaianVal": 100
          },
          {
                    "no": 29,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2024",
                    "satuan": "%",
                    "target": "93,66%",
                    "targetVal": 93.66,
                    "realisasi": "91,80%",
                    "capaian": "98,01%",
                    "status": "Tidak Tercapai",
                    "realisasiVal": 91.8,
                    "capaianVal": 98.01
          },
          {
                    "no": 30,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2024",
                    "satuan": "%",
                    "target": "62,55%",
                    "targetVal": 62.55,
                    "realisasi": "62,55%",
                    "capaian": "100,00%",
                    "status": "Tercapai",
                    "realisasiVal": 62.55,
                    "capaianVal": 100
          },
          {
                    "no": 31,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2025 (RPD)",
                    "satuan": "Nilai",
                    "target": "86,22",
                    "targetVal": 86.22,
                    "realisasi": "89,18",
                    "realisasiVal": 89.18,
                    "capaian": "103,43%",
                    "capaianVal": 103.43,
                    "status": "Melebihi Target"
          },
          {
                    "no": 32,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Konektivitas Sistem Jaringan Jalan",
                    "tahun": "2025 (RPD)",
                    "satuan": "%",
                    "target": "100,00%",
                    "targetVal": 100,
                    "realisasi": "100,00%",
                    "realisasiVal": 100,
                    "capaian": "100,00%",
                    "capaianVal": 100,
                    "status": "Tercapai"
          },
          {
                    "no": 33,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Jalan Provinsi yang Tingkat Pelayanannya (Rasio Volume Kapasitas/ RVK) < 0,75",
                    "tahun": "2025 (RPD)",
                    "satuan": "%",
                    "target": "68,38%",
                    "targetVal": 68.38,
                    "realisasi": "75,71%",
                    "realisasiVal": 75.71,
                    "capaian": "110,72%",
                    "capaianVal": 110.72,
                    "status": "Melebihi Target"
          },
          {
                    "no": 34,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Jalan Provinsi dalam kondisi mantap",
                    "tahun": "2025 (RPD)",
                    "satuan": "%",
                    "target": "86,45%",
                    "targetVal": 86.45,
                    "realisasi": "86,51%",
                    "realisasiVal": 86.51,
                    "capaian": "100,07%",
                    "capaianVal": 100.07,
                    "status": "Tercapai"
          },
          {
                    "no": 35,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Jalan Provinsi yang memenuhi persyaratan teknis jalan",
                    "tahun": "2025 (RPD)",
                    "satuan": "%",
                    "target": "53,23%",
                    "targetVal": 53.23,
                    "realisasi": "61,54%",
                    "realisasiVal": 61.54,
                    "capaian": "115,61%",
                    "capaianVal": 115.61,
                    "status": "Melebihi Target"
          },
          {
                    "no": 36,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2025",
                    "satuan": "Nilai",
                    "target": "86,22",
                    "targetVal": 86.22,
                    "realisasi": "89,18",
                    "realisasiVal": 89.18,
                    "capaian": "103,43%",
                    "capaianVal": 103.43,
                    "status": "Melebihi Target"
          },
          {
                    "no": 37,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Kemantapan Jalan",
                    "tahun": "2025",
                    "satuan": "%",
                    "target": "86,45%",
                    "targetVal": 86.45,
                    "realisasi": "86,51%",
                    "realisasiVal": 86.51,
                    "capaian": "100,07%",
                    "capaianVal": 100.07,
                    "status": "Tercapai"
          },
          {
                    "no": 38,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Lebar Jalan yang Memenuhi Standar",
                    "tahun": "2025",
                    "satuan": "%",
                    "target": "48,33%",
                    "targetVal": 48.33,
                    "realisasi": "48,35%",
                    "realisasiVal": 48.35,
                    "capaian": "100,04%",
                    "capaianVal": 100.04,
                    "status": "Tercapai"
          },
          {
                    "no": 39,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2026",
                    "satuan": "Nilai",
                    "target": "86,25",
                    "targetVal": 86.25,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 40,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Kemantapan Jalan",
                    "tahun": "2026",
                    "satuan": "%",
                    "target": "86,71%",
                    "targetVal": 86.71,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 41,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Lebar Jalan yang Memenuhi Standar",
                    "tahun": "2026",
                    "satuan": "%",
                    "target": "49,12%",
                    "targetVal": 49.12,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 42,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2027",
                    "satuan": "Nilai",
                    "target": "86,28",
                    "targetVal": 86.28,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 43,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Kemantapan Jalan",
                    "tahun": "2027",
                    "satuan": "%",
                    "target": "87,17%",
                    "targetVal": 87.17,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 44,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Lebar Jalan yang Memenuhi Standar",
                    "tahun": "2027",
                    "satuan": "%",
                    "target": "49,78%",
                    "targetVal": 49.78,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 45,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2028",
                    "satuan": "Nilai",
                    "target": "86,31",
                    "targetVal": 86.31,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 46,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Kemantapan Jalan",
                    "tahun": "2028",
                    "satuan": "%",
                    "target": "87,63%",
                    "targetVal": 87.63,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 47,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Lebar Jalan yang Memenuhi Standar",
                    "tahun": "2028",
                    "satuan": "%",
                    "target": "50,44%",
                    "targetVal": 50.44,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 48,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2029",
                    "satuan": "Nilai",
                    "target": "86,34",
                    "targetVal": 86.34,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 49,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Kemantapan Jalan",
                    "tahun": "2029",
                    "satuan": "%",
                    "target": "88,09%",
                    "targetVal": 88.09,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 50,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Lebar Jalan yang Memenuhi Standar",
                    "tahun": "2029",
                    "satuan": "%",
                    "target": "51,10%",
                    "targetVal": 51.1,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 51,
                    "jenisSasaran": "Sasaran 1",
                    "sasaranDesc": "Meningkatnya Akuntabilitas Kinerja Perangkat Daerah",
                    "name": "Nilai Evaluasi Implementasi SAKIP Perangkat Daerah",
                    "tahun": "2030",
                    "satuan": "Nilai",
                    "target": "86,37",
                    "targetVal": 86.37,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 52,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Kemantapan Jalan",
                    "tahun": "2030",
                    "satuan": "%",
                    "target": "88,54%",
                    "targetVal": 88.54,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          },
          {
                    "no": 53,
                    "jenisSasaran": "Sasaran 2",
                    "sasaranDesc": "Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar",
                    "name": "Persentase Lebar Jalan yang Memenuhi Standar",
                    "tahun": "2030",
                    "satuan": "%",
                    "target": "51,76%",
                    "targetVal": 51.76,
                    "realisasi": "-",
                    "capaian": "-",
                    "status": "Belum Ada Realisasi"
          }
]
        },
        years: {
            '2025': {
                tujuan: {
                    levelName: 'Tujuan',
                    title: 'Tujuan',
                    desc: 'Meningkatkan Kualitas dan Konektivitas Infrastruktur Jalan dan Jembatan Provinsi Jawa Timur',
                    icon: 'bi-bullseye',
                    iconBg: 'bg-blue-subtle text-primary',
                    metrics: {
                        jumlahIndikator: 1,
                        rataTarget: 73.83,
                        rataRealisasi: 78.04,
                        rataTargetText: '0,738',
                        rataRealisasiText: '0,780',
                        capaianKinerja: 106.60,
                        capaianKinerjaText: '106,60%',
                        statusText: 'Melebihi Target',
                        statusDiff: '+6,60%',
                        kategoriText: 'Sangat Baik'
                    },
                    chartData: {
                        labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
                        targets: [0.695, 0.699, 0.704, 0.848, 0.826, 0.627, 0.769, 0.636, 0.642, 0.647, 0.653, 0.659, 0.665],
                        realisasis: [0.713, 0.758, 0.707, 0.810, 0.825, 0.841, 0.809, 0.636, null, null, null, null, null],
                        capaians: [102.59, 108.44, 100.43, 95.52, 99.88, 134.13, 105.20, 100.00, null, null, null, null, null]
                    },
                    tableData: [
                        { no: 1, name: 'Indeks Konektivitas', tahun: '2019', satuan: 'Indeks', target: '0,695', realisasi: '0,713', capaian: '102,59%', status: 'Melebihi Target' },
                        { no: 2, name: 'Indeks Konektivitas', tahun: '2020', satuan: 'Indeks', target: '0,699', realisasi: '0,758', capaian: '108,44%', status: 'Melebihi Target' },
                        { no: 3, name: 'Indeks Konektivitas', tahun: '2021', satuan: 'Indeks', target: '0,704', realisasi: '0,707', capaian: '100,43%', status: 'Melebihi Target' },
                        { no: 4, name: 'Indeks Konektivitas', tahun: '2022', satuan: 'Indeks', target: '0,848', realisasi: '0,810', capaian: '95,52%', status: 'Tidak Tercapai' },
                        { no: 5, name: 'Indeks Konektivitas', tahun: '2023', satuan: 'Indeks', target: '0,826', realisasi: '0,825', capaian: '99,88%', status: 'Tidak Tercapai' },
                        { no: 6, name: 'Indeks Konektivitas', tahun: '2024', satuan: 'Indeks', target: '0,627', realisasi: '0,841', capaian: '134,13%', status: 'Melebihi Target' },
                        { no: 7, name: 'Indeks Kinerja Jalan', tahun: '2025 (RPD)', satuan: 'Indeks', target: '0,769', realisasi: '0,809', capaian: '105,20%', status: 'Melebihi Target' },
                        { no: 8, name: 'Indeks Kinerja Jalan', tahun: '2025', satuan: 'Indeks', target: '0,636', realisasi: '0,636', capaian: '100,00%', status: 'Tercapai' },
                        { no: 9, name: 'Indeks Kinerja Jalan', tahun: '2026', satuan: 'Indeks', target: '0,642', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                        { no: 10, name: 'Indeks Kinerja Jalan', tahun: '2027', satuan: 'Indeks', target: '0,647', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                        { no: 11, name: 'Indeks Kinerja Jalan', tahun: '2028', satuan: 'Indeks', target: '0,653', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                        { no: 12, name: 'Indeks Kinerja Jalan', tahun: '2029', satuan: 'Indeks', target: '0,659', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' },
                        { no: 13, name: 'Indeks Kinerja Jalan', tahun: '2030', satuan: 'Indeks', target: '0,665', realisasi: '-', capaian: '-', status: 'Belum Ada Realisasi' }
                    ]
                },
                sasaran: {
                    levelName: 'Sasaran',
                    title: 'Sasaran Strategis',
                    desc: 'Meningkatkan Kualitas dan Kuantitas Infrastruktur Jalan dan Jembatan Provinsi',
                    icon: 'bi-flag-fill',
                    iconBg: 'bg-emerald-subtle text-success',
                    metrics: {
                        jumlahIndikator: 6,
                        rataTarget: 85.00,
                        rataRealisasi: 87.40,
                        capaianKinerja: 102.82,
                        statusText: 'Melebihi Target',
                        statusDiff: '+2,82%',
                        kategoriText: 'Sangat Baik'
                    },
                    chartData: {
                        labels: [
                            ['Jalan Provinsi', 'Kondisi Mantap'],
                            ['Jembatan Provinsi', 'Kondisi Baik'],
                            ['Indeks Reformasi', 'Birokrasi (RB)'],
                            ['Nilai SAKIP', 'Perangkat Daerah'],
                            ['Indeks IP ASN', 'Kompetensi'],
                            ['Realisasi Fisik', '& Keuangan']
                        ],
                        targets: [89.50, 88.20, 85.40, 86.50, 80.00, 95.00],
                        realisasis: [91.20, 89.50, 86.10, 87.00, 82.30, 96.15]
                    },
                    tableData: [
                        { no: 1, name: 'Persentase Jalan Provinsi dalam Kondisi Mantap', satuan: '%', target: '89,50%', targetPct: '89,50%', realisasi: '91,20%', realisasiPct: '91,20%', capaian: '101,90%', status: 'Tercapai' },
                        { no: 2, name: 'Persentase Jembatan Provinsi dalam Kondisi Baik', satuan: '%', target: '88,20%', targetPct: '88,20%', realisasi: '89,50%', realisasiPct: '89,50%', capaian: '101,47%', status: 'Tercapai' },
                        { no: 3, name: 'Indeks Reformasi Birokrasi (RB) Perangkat Daerah', satuan: 'Nilai', target: '85,40', targetPct: '85,40%', realisasi: '86,10', realisasiPct: '86,10%', capaian: '100,82%', status: 'Tercapai' },
                        { no: 4, name: 'Nilai SAKIP Perangkat Daerah', satuan: 'Nilai (A)', target: '86,50', targetPct: '86,50%', realisasi: '87,00', realisasiPct: '87,00%', capaian: '100,58%', status: 'Tercapai' },
                        { no: 5, name: 'Indeks Profesionalitas ASN (IP ASN)', satuan: 'Nilai', target: '80,00', targetPct: '80,00%', realisasi: '82,30', realisasiPct: '82,30%', capaian: '102,88%', status: 'Tercapai' },
                        { no: 6, name: 'Persentase Realisasi Keuangan dan Fisik', satuan: '%', target: '95,00%', targetPct: '95,00%', realisasi: '96,15%', realisasiPct: '96,15%', capaian: '101,21%', status: 'Tercapai' }
                    ]
                },
                program: {
                    levelName: 'Program',
                    title: 'Program Kerja',
                    desc: 'Program Penyelenggaraan Jalan dan Penataan Infrastruktur Wilayah',
                    icon: 'bi-gear-fill',
                    iconBg: 'bg-teal-subtle text-teal',
                    metrics: {
                        jumlahIndikator: 8,
                        rataTarget: 88.00,
                        rataRealisasi: 91.20,
                        capaianKinerja: 103.64,
                        statusText: 'Melebihi Target',
                        statusDiff: '+3,64%',
                        kategoriText: 'Sangat Baik'
                    },
                    chartData: {
                        labels: [
                            ['Penyelenggaraan', 'Jalan Provinsi'],
                            ['Perencanaan Teknis', 'Jalan & Jembatan'],
                            ['Pengawasan', 'Konstruksi'],
                            ['Rehabilitasi Jalan', '& Pemeliharaan']
                        ],
                        targets: [88.00, 90.00, 85.00, 89.00],
                        realisasis: [91.50, 93.00, 88.50, 91.80]
                    },
                    tableData: [
                        { no: 1, name: 'Jumlah Dokumen Perencanaan dan Kebijakan Jalan yang Disusun', satuan: 'Dokumen', target: '100', targetPct: '90,00%', realisasi: '105', realisasiPct: '93,00%', capaian: '105,00%', status: 'Tercapai' },
                        { no: 2, name: 'Persentase Penanganan Jalan Provinsi Sesuai Standar', satuan: '%', target: '90,00%', targetPct: '90,00%', realisasi: '93,20%', realisasiPct: '93,20%', capaian: '103,55%', status: 'Tercapai' },
                        { no: 3, name: 'Jumlah Laporan Pemantauan dan Evaluasi Penyelenggaraan Jalan', satuan: 'Laporan', target: '12', targetPct: '85,00%', realisasi: '12', realisasiPct: '88,00%', capaian: '100,00%', status: 'Tercapai' },
                        { no: 4, name: 'Tingkat Kelaikan Fungsi Jembatan Provinsi', satuan: '%', target: '88,00%', targetPct: '88,00%', realisasi: '90,50%', realisasiPct: '90,50%', capaian: '102,84%', status: 'Tercapai' }
                    ]
                },
                kegiatan: {
                    levelName: 'Kegiatan',
                    title: '1 Kegiatan',
                    desc: 'Penyelenggaraan Jalan Provinsi dan Rekonstruksi Jembatan Wilayah',
                    icon: 'bi-journal-bookmark-fill',
                    iconBg: 'bg-amber-subtle text-warning',
                    metrics: {
                        jumlahIndikator: 18,
                        rataTarget: 86.50,
                        rataRealisasi: 89.80,
                        capaianKinerja: 103.82,
                        statusText: 'Melebihi Target',
                        statusDiff: '+3,82%',
                        kategoriText: 'Sangat Baik'
                    },
                    chartData: {
                        labels: [
                            ['Pembangunan', 'Jalan Provinsi'],
                            ['Pelebaran &', 'Rekonstruksi'],
                            ['Pemeliharaan', 'Rutin'],
                            ['Pemberdayaan', 'Masyarakat']
                        ],
                        targets: [85.00, 88.00, 90.00, 83.00],
                        realisasis: [88.50, 91.20, 93.00, 86.50]
                    },
                    tableData: [
                        { no: 1, name: 'Panjang Jalan Provinsi yang Dibangun dan Ditingkatkan', satuan: 'Km', target: '120,5', targetPct: '88,00%', realisasi: '124,8', realisasiPct: '91,20%', capaian: '103,57%', status: 'Tercapai' },
                        { no: 2, name: 'Jumlah Jembatan Provinsi yang Direkonstruksi', satuan: 'Unit', target: '25', targetPct: '85,00%', realisasi: '26', realisasiPct: '88,50%', capaian: '104,00%', status: 'Tercapai' },
                        { no: 3, name: 'Panjang Jalan Provinsi yang Dipelihara Rutin', satuan: 'Km', target: '1.450', targetPct: '90,00%', realisasi: '1.480', realisasiPct: '93,00%', capaian: '102,07%', status: 'Tercapai' },
                        { no: 4, name: 'Tingkat Kepatuhan Keselamatan Jalan Provinsi', satuan: '%', target: '83,00%', targetPct: '83,00%', realisasi: '86,50%', realisasiPct: '86,50%', capaian: '104,22%', status: 'Tercapai' }
                    ]
                },
                subkegiatan: {
                    levelName: 'Subkegiatan',
                    title: 'Subkegiatan',
                    desc: 'Pelaksanaan Teknis Rincian Indikator Subkegiatan (Data_Kinerja Excel)',
                    icon: 'bi-boxes',
                    iconBg: 'bg-cyan-subtle text-info',
                    metrics: {
                        jumlahIndikator: 32,
                        rataTarget: 87.20,
                        rataRealisasi: 90.40,
                        capaianKinerja: 103.67,
                        statusText: 'Melebihi Target',
                        statusDiff: '+3,67%',
                        kategoriText: 'Sangat Baik'
                    },
                    chartData: {
                        labels: [
                            ['Penyusunan Rencana', '& Kebijakan'],
                            ['Pengelolaan Leger', 'Jalan Provinsi'],
                            ['Pembebasan Lahan', 'Jalan'],
                            ['Pemeriksaan Teknis', 'Kelaikan']
                        ],
                        targets: [85.00, 88.00, 89.00, 86.50],
                        realisasis: [88.00, 91.00, 92.50, 90.00]
                    },
                    tableData: [
                        { no: 1, name: 'Jumlah Dokumen Rencana, Kebijakan, dan Strategi Teknis Jalan yang Disusun', satuan: 'Dokumen', target: '4', targetPct: '85,00%', realisasi: '4', realisasiPct: '88,00%', capaian: '100,00%', status: 'Tercapai' },
                        { no: 2, name: 'Jumlah Dokumen Leger Jalan yang Dikelola', satuan: 'Dokumen', target: '1', targetPct: '88,00%', realisasi: '1', realisasiPct: '91,00%', capaian: '100,00%', status: 'Tercapai' },
                        { no: 3, name: 'Jumlah Laporan Pengendalian dan Evaluasi Kebijakan Penyelenggaraan Jalan', satuan: 'Laporan', target: '12', targetPct: '89,00%', realisasi: '12', realisasiPct: '92,50%', capaian: '100,00%', status: 'Tercapai' },
                        { no: 4, name: 'Persentase Rekomendasi Teknis Penyelenggaraan Jalan yang Diterbitkan', satuan: '%', target: '100%', targetPct: '86,50%', realisasi: '100%', realisasiPct: '90,00%', capaian: '100,00%', status: 'Tercapai' }
                    ]
                }
            }
        }
    };

    function isKinerjaYearMatch(rowTahun, filterYear) {
        if (!filterYear || filterYear === 'all') return true;
        const rYear = (rowTahun || '').toString().trim();
        const fYear = filterYear.toString().trim();
        if (fYear === '2025 RPD' || fYear === '2025 (RPD)') {
            return rYear.includes('RPD');
        }
        if (fYear === '2025') {
            return rYear === '2025' || (rYear.includes('2025') && !rYear.includes('RPD'));
        }
        return rYear === fYear || rYear.includes(fYear);
    }

    function isChartLabelMatch(label, activeYear) {
        if (!activeYear || activeYear === 'all') return true;
        const lblStr = Array.isArray(label) ? label.join(' ') : String(label);
        const fYear = activeYear.toString().trim();
        if (fYear === '2025 RPD' || fYear === '2025 (RPD)') {
            return lblStr.includes('RPD');
        }
        if (fYear === '2025') {
            return lblStr === '2025' || (lblStr.includes('2025') && !lblStr.includes('RPD'));
        }
        return lblStr === fYear || lblStr.includes(fYear);
    }

    const TUJUAN_NARRATIVES = {
        'all': `
            <div class="d-flex flex-column gap-2 mt-1">
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 145px; width: 145px;">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Periode 2019 - 2024</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur</div>
                </div>
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 145px; width: 145px;">
                        <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Periode 2025 (RPD)</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Terwujudnya jalan provinsi yang andal dan berkelanjutan dalam rangka memenuhi kebutuhan aksesibilitas, konektivitas, dan mobilitas jaringan transportasi darat, guna meningkatkan pertumbuhan dan pemerataan ekonomi di Jawa Timur.</div>
                </div>
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 145px; width: 145px;">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Periode 2025 - 2030</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah</div>
                </div>
            </div>
        `,
        '2019': 'Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur',
        '2020': 'Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur',
        '2021': 'Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur',
        '2022': 'Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur',
        '2023': 'Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur',
        '2024': 'Mewujudkan pelayanan jalan provinsi yang handal dalam rangka mendukung jalur distribusi darat yang prima (aksesibilitas & mobilitas), mendorong dan meningkatkan keseimbangan antar wilayah serta pemerataan pertumbuhan ekonomi di Jawa Timur',
        '2025 RPD': 'Terwujudnya jalan provinsi yang andal dan berkelanjutan dalam rangka memenuhi kebutuhan aksesibilitas, konektivitas, dan mobilitas jaringan transportasi darat, guna meningkatkan pertumbuhan dan pemerataan ekonomi di Jawa Timur.',
        '2025 (RPD)': 'Terwujudnya jalan provinsi yang andal dan berkelanjutan dalam rangka memenuhi kebutuhan aksesibilitas, konektivitas, dan mobilitas jaringan transportasi darat, guna meningkatkan pertumbuhan dan pemerataan ekonomi di Jawa Timur.',
        '2025': 'Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah',
        '2026': 'Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah',
        '2027': 'Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah',
        '2028': 'Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah',
        '2029': 'Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah',
        '2030': 'Terwujudnya Jalan Provinsi yang Berkualitas Dalam Rangka Memperkuat Konektivitas Wilayah'
    };

    const TUJUAN_YEAR_DATA = {
        'all': {
            targetText: '0,738',
            realisasiText: '0,780',
            capaianText: '106,60%',
            capaianPct: 106.60,
            statusText: 'Melebihi Target',
            statusDiff: '+0,042',
            kategoriText: 'Sangat Baik'
        },
        '2019': {
            targetText: '0,695',
            realisasiText: '0,713',
            capaianText: '102,59%',
            capaianPct: 102.59,
            statusText: 'Melebihi Target',
            statusDiff: '+2,59%',
            kategoriText: 'Sangat Baik'
        },
        '2020': {
            targetText: '0,699',
            realisasiText: '0,758',
            capaianText: '108,44%',
            capaianPct: 108.44,
            statusText: 'Melebihi Target',
            statusDiff: '+8,44%',
            kategoriText: 'Sangat Baik'
        },
        '2021': {
            targetText: '0,704',
            realisasiText: '0,707',
            capaianText: '100,43%',
            capaianPct: 100.43,
            statusText: 'Melebihi Target',
            statusDiff: '+0,43%',
            kategoriText: 'Sangat Baik'
        },
        '2022': {
            targetText: '0,848',
            realisasiText: '0,810',
            capaianText: '95,52%',
            capaianPct: 95.52,
            statusText: 'Tidak Tercapai',
            statusDiff: '-4,48%',
            kategoriText: 'Kurang'
        },
        '2023': {
            targetText: '0,826',
            realisasiText: '0,825',
            capaianText: '99,88%',
            capaianPct: 99.88,
            statusText: 'Tidak Tercapai',
            statusDiff: '-0,12%',
            kategoriText: 'Kurang'
        },
        '2024': {
            targetText: '0,627',
            realisasiText: '0,841',
            capaianText: '134,13%',
            capaianPct: 134.13,
            statusText: 'Melebihi Target',
            statusDiff: '+34,13%',
            kategoriText: 'Sangat Baik'
        },
        '2025 RPD': {
            targetText: '0,769',
            realisasiText: '0,809',
            capaianText: '105,20%',
            capaianPct: 105.20,
            statusText: 'Melebihi Target',
            statusDiff: '+0,040',
            kategoriText: 'Sangat Baik'
        },
        '2025 (RPD)': {
            targetText: '0,769',
            realisasiText: '0,809',
            capaianText: '105,20%',
            capaianPct: 105.20,
            statusText: 'Melebihi Target',
            statusDiff: '+0,040',
            kategoriText: 'Sangat Baik'
        },
        '2025': {
            targetText: '0,636',
            realisasiText: '0,636',
            capaianText: '100,00%',
            capaianPct: 100.00,
            statusText: 'Target Tercapai',
            statusDiff: '0,000',
            kategoriText: 'Baik'
        },
        '2026': {
            targetText: '0,642',
            realisasiText: '-',
            capaianText: '-',
            capaianPct: 0,
            statusText: 'Belum Ada Realisasi',
            statusDiff: '-',
            kategoriText: 'Belum Ada Realisasi'
        },
        '2027': {
            targetText: '0,647',
            realisasiText: '-',
            capaianText: '-',
            capaianPct: 0,
            statusText: 'Belum Ada Realisasi',
            statusDiff: '-',
            kategoriText: 'Belum Ada Realisasi'
        },
        '2028': {
            targetText: '0,653',
            realisasiText: '-',
            capaianText: '-',
            capaianPct: 0,
            statusText: 'Belum Ada Realisasi',
            statusDiff: '-',
            kategoriText: 'Belum Ada Realisasi'
        },
        '2029': {
            targetText: '0,659',
            realisasiText: '-',
            capaianText: '-',
            capaianPct: 0,
            statusText: 'Belum Ada Realisasi',
            statusDiff: '-',
            kategoriText: 'Belum Ada Realisasi'
        },
        '2030': {
            targetText: '0,665',
            realisasiText: '-',
            capaianText: '-',
            capaianPct: 0,
            statusText: 'Belum Ada Realisasi',
            statusDiff: '-',
            kategoriText: 'Belum Ada Realisasi'
        }
    };

    const SASARAN_NARRATIVES = {
        'all': `
            <div class="d-flex flex-column gap-2 mt-1">
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 160px; width: 160px;">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 1 (2019 - 2030)</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                </div>
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 160px; width: 160px;">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 2 (2019 - 2020)</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial</div>
                </div>
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 160px; width: 160px;">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 2 (2021 - 2024)</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar</div>
                </div>
                <div class="d-flex align-items-baseline gap-2">
                    <div style="flex: 0 0 160px; width: 160px;">
                        <span class="badge bg-emerald-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 2 (2025 - 2030)</span>
                    </div>
                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
                </div>
            </div>
        `,
        '2019': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial</div>
            </div>
        `,
        '2020': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial</div>
            </div>
        `,
        '2021': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar</div>
            </div>
        `,
        '2022': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar</div>
            </div>
        `,
        '2023': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar</div>
            </div>
        `,
        '2024': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar</div>
            </div>
        `,
        '2025 RPD': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2025 (RPD)': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2025': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2026': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2027': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2028': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2029': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `,
        '2030': `
            <div class="d-flex flex-column gap-1.5 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                <div><span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 1</span> Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
            </div>
        `
    };

    const SASARAN_YEAR_DATA = {
        'all': { count: 53, rataTarget: 76.58, rataTargetText: '76,58%', rataRealisasi: 77.40, rataRealisasiText: '77,40%', capaianText: '101,72%', capaianPct: 101.72, statusText: 'Melebihi Target', statusDiff: '+1,72%', kategoriText: 'Sangat Baik' },
        '2019': { count: 5, rataTarget: 71.03, rataTargetText: '71,03%', rataRealisasi: 72.79, rataRealisasiText: '72,79%', capaianText: '106,71%', capaianPct: 106.71, statusText: 'Melebihi Target', statusDiff: '+6,71%', kategoriText: 'Sangat Baik' },
        '2020': { count: 5, rataTarget: 71.76, rataTargetText: '71,76%', rataRealisasi: 77.61, rataRealisasiText: '77,61%', capaianText: '122,91%', capaianPct: 122.91, statusText: 'Melebihi Target', statusDiff: '+22,91%', kategoriText: 'Sangat Baik' },
        '2021': { count: 5, rataTarget: 72.39, rataTargetText: '72,39%', rataRealisasi: 72.46, rataRealisasiText: '72,46%', capaianText: '103,02%', capaianPct: 103.02, statusText: 'Melebihi Target', statusDiff: '+3,02%', kategoriText: 'Sangat Baik' },
        '2022': { count: 5, rataTarget: 86.76, rataTargetText: '86,76%', rataRealisasi: 83.02, rataRealisasiText: '83,02%', capaianText: '96,02%', capaianPct: 96.02, statusText: 'Di Bawah Target', statusDiff: '-3,98%', kategoriText: 'Kurang' },
        '2023': { count: 5, rataTarget: 86.14, rataTargetText: '86,14%', rataRealisasi: 84.47, rataRealisasiText: '84,47%', capaianText: '98,19%', capaianPct: 98.19, statusText: 'Di Bawah Target', statusDiff: '-1,81%', kategoriText: 'Kurang' },
        '2024': { count: 5, rataTarget: 86.16, rataTargetText: '86,16%', rataRealisasi: 85.95, rataRealisasiText: '85,95%', capaianText: '99,90%', capaianPct: 99.90, statusText: 'Tidak Tercapai', statusDiff: '-0,10%', kategoriText: 'Kurang' },
        '2025 RPD': { count: 5, rataTarget: 78.86, rataTargetText: '78,86%', rataRealisasi: 82.59, rataRealisasiText: '82,59%', capaianText: '105,97%', capaianPct: 105.97, statusText: 'Melebihi Target', statusDiff: '+3,73%', kategoriText: 'Sangat Baik' },
        '2025 (RPD)': { count: 5, rataTarget: 78.86, rataTargetText: '78,86%', rataRealisasi: 82.59, rataRealisasiText: '82,59%', capaianText: '105,97%', capaianPct: 105.97, statusText: 'Melebihi Target', statusDiff: '+3,73%', kategoriText: 'Sangat Baik' },
        '2025': { count: 3, rataTarget: 73.67, rataTargetText: '73,67%', rataRealisasi: 74.68, rataRealisasiText: '74,68%', capaianText: '101,18%', capaianPct: 101.18, statusText: 'Melebihi Target', statusDiff: '+1,01%', kategoriText: 'Sangat Baik' },
        '2026': { count: 3, rataTarget: 74.03, rataTargetText: '74,03%', rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2027': { count: 3, rataTarget: 74.41, rataTargetText: '74,41%', rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2028': { count: 3, rataTarget: 74.79, rataTargetText: '74,79%', rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2029': { count: 3, rataTarget: 75.18, rataTargetText: '75,18%', rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2030': { count: 3, rataTarget: 75.56, rataTargetText: '75,56%', rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' }
    };



    const SASARAN_1_YEAR_DATA = {
        'all': {
            count: 7,
            rataTarget: 86.05,
            rataTargetText: '86,05',
            rataRealisasi: 85.86,
            rataRealisasiText: '85,86',
            capaianText: '99,79%',
            capaianPct: 99.79,
            statusText: 'Kategori Kurang',
            statusTitle: 'Tidak Tercapai',
            statusDiff: '-0,19',
            kategoriText: 'Kurang'
        },
        '2019': { targetText: '84,48', targetVal: 84.48, realisasiText: '84,48', realisasiVal: 84.48, capaianText: '100,00%', capaianPct: 100.00, statusText: 'Mencapai Target', statusTitle: 'Target Tercapai', statusDiff: '0,00', kategoriText: 'Baik' },
        '2020': { targetText: '86,28', targetVal: 86.28, realisasiText: '84,91', realisasiVal: 84.91, capaianText: '98,41%', capaianPct: 98.41, statusText: 'Tidak Tercapai', statusTitle: 'Tidak Tercapai', statusDiff: '-1,37', kategoriText: 'Kurang' },
        '2021': { targetText: '87,18', targetVal: 87.18, realisasiText: '84,95', realisasiVal: 84.95, capaianText: '97,44%', capaianPct: 97.44, statusText: 'Tidak Tercapai', statusTitle: 'Tidak Tercapai', statusDiff: '-2,23', kategoriText: 'Kurang' },
        '2022': { targetText: '88,10', targetVal: 88.10, realisasiText: '85,78', realisasiVal: 85.78, capaianText: '97,37%', capaianPct: 97.37, statusText: 'Tidak Tercapai', statusTitle: 'Tidak Tercapai', statusDiff: '-2,32', kategoriText: 'Kurang' },
        '2023': { targetText: '85,00', targetVal: 85.00, realisasiText: '85,83', realisasiVal: 85.83, capaianText: '100,98%', capaianPct: 100.98, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+0,83', kategoriText: 'Sangat Baik' },
        '2024': { targetText: '85,10', targetVal: 85.10, realisasiText: '85,88', realisasiVal: 85.88, capaianText: '100,92%', capaianPct: 100.92, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+0,78', kategoriText: 'Sangat Baik' },
        '2025 RPD': { count: 1, targetText: '86,22', targetVal: 86.22, realisasiText: '89,18', realisasiVal: 89.18, capaianText: '103,43%', capaianPct: 103.43, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+2,96', kategoriText: 'Sangat Baik' },
        '2025 (RPD)': { count: 1, targetText: '86,22', targetVal: 86.22, realisasiText: '89,18', realisasiVal: 89.18, capaianText: '103,43%', capaianPct: 103.43, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+2,96', kategoriText: 'Sangat Baik' },
        '2025': { count: 1, targetText: '86,22', targetVal: 86.22, realisasiText: '89,18', realisasiVal: 89.18, capaianText: '103,43%', capaianPct: 103.43, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+2,96', kategoriText: 'Sangat Baik' },
        '2026': { targetText: '86,25', targetVal: 86.25, realisasiText: '-', realisasiVal: null, capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2027': { targetText: '86,28', targetVal: 86.28, realisasiText: '-', realisasiVal: null, capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2028': { targetText: '86,31', targetVal: 86.31, realisasiText: '-', realisasiVal: null, capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2029': { targetText: '86,34', targetVal: 86.34, realisasiText: '-', realisasiVal: null, capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2030': { targetText: '86,37', targetVal: 86.37, realisasiText: '-', realisasiVal: null, capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' }
    };

    const SASARAN_2_YEAR_DATA = {
        'all': { count: 46, rataTarget: 74.71, rataTargetText: '74,71%', rataRealisasi: 78.41, rataRealisasiText: '78,41%', capaianText: '102,08%', capaianPct: 102.08, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+3,70%', kategoriText: 'Sangat Baik' },
        '2019': { count: 4, rataTarget: 67.67, rataTargetText: '67,67%', rataRealisasi: 69.87, rataRealisasiText: '69,87%', capaianText: '108,38%', capaianPct: 108.38, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+2,20%', kategoriText: 'Sangat Baik' },
        '2020': { count: 4, rataTarget: 68.13, rataTargetText: '68,13%', rataRealisasi: 75.44, rataRealisasiText: '75,44%', capaianText: '128,64%', capaianPct: 128.64, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+7,31%', kategoriText: 'Sangat Baik' },
        '2021': { count: 4, rataTarget: 68.69, rataTargetText: '68,69%', rataRealisasi: 69.33, rataRealisasiText: '69,33%', capaianText: '104,42%', capaianPct: 104.42, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+0,64%', kategoriText: 'Sangat Baik' },
        '2022': { count: 4, rataTarget: 86.43, rataTargetText: '86,43%', rataRealisasi: 82.33, rataRealisasiText: '82,33%', capaianText: '95,69%', capaianPct: 95.69, statusText: 'Tidak Tercapai', statusTitle: 'Tidak Tercapai', statusDiff: '-4,10%', kategoriText: 'Kurang' },
        '2023': { count: 4, rataTarget: 86.43, rataTargetText: '86,43%', rataRealisasi: 84.13, rataRealisasiText: '84,13%', capaianText: '97,49%', capaianPct: 97.49, statusText: 'Tidak Tercapai', statusTitle: 'Tidak Tercapai', statusDiff: '-2,30%', kategoriText: 'Kurang' },
        '2024': { count: 4, rataTarget: 86.43, rataTargetText: '86,43%', rataRealisasi: 85.97, rataRealisasiText: '85,97%', capaianText: '99,65%', capaianPct: 99.65, statusText: 'Tidak Tercapai', statusTitle: 'Tidak Tercapai', statusDiff: '-0,46%', kategoriText: 'Kurang' },
        '2025 RPD': { count: 4, rataTarget: 77.02, rataTargetText: '77,02%', rataRealisasi: 80.94, rataRealisasiText: '80,94%', capaianText: '106,60%', capaianPct: 106.60, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+3,92%', kategoriText: 'Sangat Baik' },
        '2025 (RPD)': { count: 4, rataTarget: 77.02, rataTargetText: '77,02%', rataRealisasi: 80.94, rataRealisasiText: '80,94%', capaianText: '106,60%', capaianPct: 106.60, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+3,92%', kategoriText: 'Sangat Baik' },
        '2025': { count: 2, rataTarget: 67.39, rataTargetText: '67,39%', rataRealisasi: 67.43, rataRealisasiText: '67,43%', capaianText: '100,06%', capaianPct: 100.06, statusText: 'Melebihi Target', statusTitle: 'Melampaui Target', statusDiff: '+0,04%', kategoriText: 'Sangat Baik' },
        '2026': { count: 2, rataTarget: 67.91, rataTargetText: '67,91%', rataRealisasi: null, rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2027': { count: 2, rataTarget: 68.48, rataTargetText: '68,48%', rataRealisasi: null, rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2028': { count: 2, rataTarget: 69.04, rataTargetText: '69,04%', rataRealisasi: null, rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2029': { count: 2, rataTarget: 69.60, rataTargetText: '69.60%', rataRealisasi: null, rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' },
        '2030': { count: 2, rataTarget: 70.15, rataTargetText: '70,15%', rataRealisasi: null, rataRealisasiText: '-', capaianText: '-', capaianPct: 0, statusText: 'Belum Ada Realisasi', statusTitle: 'Belum Ada Realisasi', statusDiff: '-', kategoriText: 'Belum Ada Realisasi' }
    };



    function getSasaranChartForYear(year, sasaranFilter = 'all') {
        const rows = (KINERJA_HIERARCHY_DATA.sasaran && KINERJA_HIERARCHY_DATA.sasaran.tableData) || [];
        let matched = rows.filter(r => isKinerjaYearMatch(r.tahun, year));
        if (sasaranFilter && sasaranFilter !== 'all') {
            matched = matched.filter(r => r.jenisSasaran === sasaranFilter);
        }
        const labels = [];
        const targets = [];
        const realisasis = [];
        const capaians = [];
        matched.forEach(r => {
            let shortName = r.name;
            if (shortName.includes('SAKIP')) shortName = ['SAKIP Perangkat', 'Daerah'];
            else if (shortName.includes('Konektivitas Sistem Jaringan')) shortName = ['RPD: Konektivitas', 'Jaringan Jalan'];
            else if (shortName.includes('Konektivitas')) shortName = 'Konektivitas';
            else if (shortName.includes('Tingkat Pelayanan') && shortName.includes('LoS')) shortName = ['LoS Minimal B', '(Pelayanan)'];
            else if (shortName.includes('RVK') || shortName.includes('Rasio Volume')) shortName = ['RVK < 0,75', '(Pelayanan)'];
            else if (shortName.includes('kondisi mantap')) shortName = ['Kondisi', 'Mantap'];
            else if (shortName.includes('Kemantapan')) shortName = ['Kemantapan', 'Jalan'];
            else if (shortName.includes('persyaratan teknis')) shortName = ['Persyaratan', 'Teknis'];
            else if (shortName.includes('Lebar Jalan')) shortName = ['Lebar Jalan', 'Standar'];
            
            if (r.tahun.includes('RPD') && Array.isArray(shortName) && !shortName[0].startsWith('RPD:')) {
                shortName = [`RPD: ${shortName[0]}`, shortName[1]];
            }

            labels.push(shortName);
            targets.push(r.targetVal);
            realisasis.push((r.realisasiVal !== undefined && r.realisasiVal !== null) ? r.realisasiVal : null);
            capaians.push((r.capaianVal !== undefined && r.capaianVal !== null) ? r.capaianVal : null);
        });
        return { labels, targets, realisasis, capaians };
    }

    window.changeTujuanBannerYear = function(year) {
        const heroDesc = document.getElementById('hero-level-desc');
        const level = targetKinerjaState.activeLevel || 'tujuan';
        if (heroDesc) {
            if (level === 'sasaran') {
                heroDesc.innerHTML = SASARAN_NARRATIVES[year] || SASARAN_NARRATIVES['all'];
            } else {
                if (year === 'all' || year === '2025') {
                    heroDesc.innerHTML = TUJUAN_NARRATIVES[year] || TUJUAN_NARRATIVES['all'];
                } else {
                    heroDesc.textContent = TUJUAN_NARRATIVES[year] || TUJUAN_NARRATIVES['all'];
                }
            }
        }
    };

    const targetKinerjaState = {
        activeYear: 'All',
        activeLevel: 'tujuan', // 'tujuan', 'sasaran', 'program', 'kegiatan', 'subkegiatan'
        activeSasaranTab: 'all', // 'all', 'Sasaran 1', 'Sasaran 2'
        searchQuery: '',
        currentPage: 1,
        pageSize: 10
    };

    window.switchSasaranTab = function(tab) {
        targetKinerjaState.activeSasaranTab = tab;
        targetKinerjaState.currentPage = 1;
        renderTargetKinerjaTab();
    };

    // Global switcher for Year
    window.setTargetKinerjaYear = function(year) {
        targetKinerjaState.activeYear = String(year);
        const activeLabel = document.getElementById('target-kinerja-active-year');
        if (activeLabel) {
            activeLabel.textContent = `Tahun Anggaran ${year}`;
        }
        
        // Update active class in dropdown menu if exists
        const dropdownItems = document.querySelectorAll('#target-kinerja-year-dropdown .dropdown-item');
        if (dropdownItems.length > 0) {
            dropdownItems.forEach(item => {
                if (item.textContent.includes(year)) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }

        renderTargetKinerjaTab();
    };

    // Global switcher for Hierarchy Level (Tujuan -> Sasaran -> Program -> Kegiatan -> Subkegiatan)
    window.switchKinerjaLevel = function(level) {
        targetKinerjaState.activeLevel = level;
        targetKinerjaState.searchQuery = '';
        targetKinerjaState.currentPage = 1;
        if (level === 'sasaran') {
            targetKinerjaState.activeSasaranTab = 'all';
        }

        const searchInput = document.getElementById('kinerja-table-search');
        if (searchInput) searchInput.value = '';

        // Update active class on stepper cards
        const stepItems = document.querySelectorAll('.kinerja-step-item, .kinerja-step-card');
        stepItems.forEach(item => {
            item.classList.remove('active');
        });
        const activeStep = document.getElementById(`step-${level}`);
        if (activeStep) activeStep.classList.add('active');

        // Update active class on sub-sidebar buttons
        ['tujuan', 'sasaran', 'program', 'kegiatan', 'subkegiatan'].forEach(lvl => {
            const b = document.getElementById(`kinerja-${lvl}-tab`);
            if (b) {
                if (lvl === level) {
                    b.classList.add('active');
                    b.setAttribute('aria-selected', 'true');
                } else {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                }
            }
        });
        if (typeof setKinerjaParentActive === 'function') {
            setKinerjaParentActive(true);
        }

        renderTargetKinerjaTab();
    };

    // Export Table Data to CSV
    window.exportKinerjaCSV = function() {
        const level = targetKinerjaState.activeLevel || 'tujuan';
        const activeYear = (state && state.activeFilters && state.activeFilters.tahun) ? state.activeFilters.tahun : 'all';
        const isTujuan = (level === 'tujuan');
        const isSasaran = (level === 'sasaran');

        let currentLevelData;
        if (isTujuan) {
            currentLevelData = KINERJA_HIERARCHY_DATA.tujuan;
        } else if (isSasaran) {
            currentLevelData = KINERJA_HIERARCHY_DATA.sasaran;
        } else {
            const yearData = KINERJA_HIERARCHY_DATA.years[activeYear] || KINERJA_HIERARCHY_DATA.years['2025'];
            currentLevelData = yearData[level] || yearData.sasaran;
        }

        let rows = currentLevelData.tableData || [];
        if ((isTujuan || isSasaran) && activeYear !== 'all') {
            rows = rows.filter(r => (r.tahun || '').includes(activeYear));
        }
        if (isSasaran && targetKinerjaState.activeSasaranTab && targetKinerjaState.activeSasaranTab !== 'all') {
            rows = rows.filter(r => r.jenisSasaran === targetKinerjaState.activeSasaranTab);
        }

        if (isSasaran) {
            const S2_ORDER = { 'kemantapan': 1, 'lebar_teknis': 2, 'pelayanan': 3, 'konektivitas': 4 };
            rows = [...rows].sort((a, b) => {
                const yrA = (a.tahun || '').replace(/[^0-9]/g, '');
                const yrB = (b.tahun || '').replace(/[^0-9]/g, '');
                if (yrA !== yrB) return yrA.localeCompare(yrB);

                if (a.jenisSasaran !== b.jenisSasaran) {
                    return a.jenisSasaran === 'Sasaran 1' ? -1 : 1;
                }

                if (a.jenisSasaran === 'Sasaran 2') {
                    return (S2_ORDER[getS2GroupKey(a.name)] || 99) - (S2_ORDER[getS2GroupKey(b.name)] || 99);
                }

                return 0;
            });
        }

        let csvContent = 'data:text/csv;charset=utf-8,﻿';
        csvContent += `No,Tahun,Jenis Sasaran,Indikator ${currentLevelData.title},Satuan,Target,Realisasi,Capaian,Status\n`;

        rows.forEach((row, idx) => {
            const noUrut = ((isTujuan || isSasaran) && activeYear !== 'all') ? (idx + 1) : row.no;
            const jenisSas = row.jenisSasaran || '';
            csvContent += `"${noUrut}","${row.tahun || ''}","${jenisSas}","${(row.name || '').replace(/"/g, '""')}","${row.satuan}","${row.target}","${row.realisasi}","${row.capaian}","${row.status}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Daftar_Indikator_${level.toUpperCase()}_${activeYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper status & color capaian
    // 1. Capaian < 100%: status 'Kurang', warna merah (#dc2626)
    // 2. Capaian = 100%: status 'Baik', warna hijau (#16a34a)
    // 3. Capaian > 100%: status 'Sangat Baik', warna biru (#2563eb)
    function getKinerjaCapaianStatusInfo(capaian) {
        if (capaian === null || capaian === undefined || isNaN(capaian) || capaian <= 0) {
            return {
                kategori: 'Belum Ada Realisasi',
                status: 'Belum Ada Realisasi',
                gaugeColor: '#cbd5e1',
                theme: 'secondary',
                textColor: '#64748b',
                boxBg: '#f8fafc',
                boxBorder: '#e2e8f0',
                icon: 'bi-hourglass-split'
            };
        }
        if (capaian > 100) {
            return {
                kategori: 'Sangat Baik',
                status: 'Melebihi Target',
                gaugeColor: '#2563eb', // Biru saat capaian > 100%
                theme: 'primary',
                textColor: '#2563eb',
                boxBg: '#eff6ff',
                boxBorder: '#bfdbfe',
                icon: 'bi-check-all'
            };
        }
        if (Math.abs(capaian - 100) < 0.001) {
            return {
                kategori: 'Baik',
                status: 'Mencapai Target',
                gaugeColor: '#16a34a', // Hijau saat capaian = 100%
                theme: 'success',
                textColor: '#16a34a',
                boxBg: '#f0fdf4',
                boxBorder: '#bbf7d0',
                icon: 'bi-check-circle-fill'
            };
        }
        // Capaian < 100%
        return {
            kategori: 'Kurang',
            status: 'Tidak Tercapai',
            gaugeColor: '#dc2626', // Merah saat capaian < 100%
            theme: 'danger',
            textColor: '#dc2626',
            boxBg: '#fef2f2',
            boxBorder: '#fecaca',
            icon: 'bi-x-circle-fill'
        };
    }


    // --- SASARAN 2 MULTI-INDICATOR IMPLEMENTATION ---
    const S2_TIMELINES = {
        'kemantapan': {
            key: 'kemantapan',
            defaultName: 'Persentase Kemantapan Jalan',
            satuan: '%',
            labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
            targets: [91.77, 91.77, 92.09, 93.66, 93.66, 93.66, 86.45, 86.45, 86.71, 87.17, 87.63, 88.09, 88.54],
            realisasis: [91.77, 91.77, 92.09, 89.10, 89.50, 91.80, 86.51, 86.51, null, null, null, null, null],
            capaians: [100.00, 100.00, 100.00, 95.13, 95.56, 98.01, 100.07, 100.07, null, null, null, null, null]
        },
        'lebar_teknis': {
            key: 'lebar_teknis',
            defaultName: 'Persentase Lebar Jalan yang Memenuhi Standar',
            satuan: '%',
            labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
            targets: [61.82, 62.45, 63.14, 62.55, 62.55, 62.55, 53.23, 48.33, 49.12, 49.78, 50.44, 51.10, 51.76],
            realisasis: [61.82, 62.45, 63.14, 62.57, 60.52, 62.55, 61.54, 48.35, null, null, null, null, null],
            capaians: [100.00, 100.00, 100.00, 100.03, 96.75, 100.00, 115.61, 100.04, null, null, null, null, null]
        },
        'pelayanan': {
            key: 'pelayanan',
            defaultName: 'Persentase Jalan Provinsi yang Tingkat Pelayanannya (RVK / LoS)',
            satuan: '%',
            labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
            targets: [24.09, 25.28, 26.52, 89.51, 89.51, 89.51, 68.38, 68.38, 89.51, 89.51, 89.51, 89.51, 89.51],
            realisasis: [32.90, 54.54, 29.10, 84.66, 86.50, 89.51, 75.71, 75.71, null, null, null, null, null],
            capaians: [136.57, 215.74, 109.73, 94.58, 96.64, 100.00, 110.72, 110.72, null, null, null, null, null]
        },
        'konektivitas': {
            key: 'konektivitas',
            defaultName: 'Konektivitas Jaringan Jalan',
            satuan: '%',
            labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
            targets: [93.00, 93.00, 93.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00],
            realisasis: [93.00, 93.00, 93.00, 100.00, 100.00, 100.00, 100.00, 100.00, null, null, null, null, null],
            capaians: [100.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00, 100.00, null, null, null, null, null]
        }
    };

    function getS2GroupKey(name) {
        const low = (name || '').toLowerCase();
        if (low.includes('mantap') || low.includes('kemantapan')) return 'kemantapan';
        if (low.includes('teknis') || low.includes('lebar')) return 'lebar_teknis';
        if (low.includes('pelayanan') || low.includes('los') || low.includes('rvk')) return 'pelayanan';
        if (low.includes('konektivitas')) return 'konektivitas';
        return 'kemantapan';
    }

    function getSasaran2IndicatorsList(activeYear) {
        const allSasaran = (KINERJA_HIERARCHY_DATA && KINERJA_HIERARCHY_DATA.sasaran && KINERJA_HIERARCHY_DATA.sasaran.tableData) || [];
        const s2Rows = allSasaran.filter(r => r.jenisSasaran === 'Sasaran 2');

        if (activeYear === 'all') {
            return [
                {
                    groupKey: 'kemantapan',
                    displayName: 'Persentase Kemantapan Jalan',
                    name: 'Persentase Kemantapan Jalan',
                    satuan: '%',
                    target: '89,75%',
                    targetVal: 89.75,
                    realisasi: '86,51%',
                    realisasiVal: 86.51,
                    capaian: '100,07%',
                    capaianVal: 100.07,
                    status: 'Tercapai',
                    timeline: S2_TIMELINES.kemantapan,
                    tableRows: s2Rows.filter(r => getS2GroupKey(r.name) === 'kemantapan')
                },
                {
                    groupKey: 'lebar_teknis',
                    displayName: 'Persentase Lebar Jalan Standar / Persyaratan Teknis',
                    name: 'Persentase Lebar Jalan yang Memenuhi Standar',
                    satuan: '%',
                    target: '58,41%',
                    targetVal: 58.41,
                    realisasi: '54,95%',
                    realisasiVal: 54.95,
                    capaian: '107,83%',
                    capaianVal: 107.83,
                    status: 'Melebihi Target',
                    timeline: S2_TIMELINES.lebar_teknis,
                    tableRows: s2Rows.filter(r => getS2GroupKey(r.name) === 'lebar_teknis')
                },
                {
                    groupKey: 'pelayanan',
                    displayName: 'Tingkat Pelayanan Jalan (LoS minimal B / RVK < 0,75)',
                    name: 'Persentase Jalan Provinsi yang Tingkat Pelayanannya',
                    satuan: '%',
                    target: '59,04%',
                    targetVal: 59.04,
                    realisasi: '75,71%',
                    realisasiVal: 75.71,
                    capaian: '110,72%',
                    capaianVal: 110.72,
                    status: 'Melebihi Target',
                    timeline: S2_TIMELINES.pelayanan,
                    tableRows: s2Rows.filter(r => getS2GroupKey(r.name) === 'pelayanan')
                },
                {
                    groupKey: 'konektivitas',
                    displayName: 'Konektivitas Jaringan Jalan',
                    name: 'Konektivitas Sistem Jaringan Jalan',
                    satuan: '%',
                    target: '97,00%',
                    targetVal: 97.00,
                    realisasi: '100,00%',
                    realisasiVal: 100.00,
                    capaian: '100,00%',
                    capaianVal: 100.00,
                    status: 'Tercapai',
                    timeline: S2_TIMELINES.konektivitas,
                    tableRows: s2Rows.filter(r => getS2GroupKey(r.name) === 'konektivitas')
                }
            ];
        }

        const S2_ORDER = { 'kemantapan': 1, 'lebar_teknis': 2, 'pelayanan': 3, 'konektivitas': 4 };
        const matched = s2Rows.filter(r => isKinerjaYearMatch(r.tahun, activeYear));
        matched.sort((a, b) => (S2_ORDER[getS2GroupKey(a.name)] || 99) - (S2_ORDER[getS2GroupKey(b.name)] || 99));

        return matched.map(r => {
            const grp = getS2GroupKey(r.name);
            return {
                groupKey: grp,
                displayName: r.name,
                name: r.name,
                satuan: r.satuan || '%',
                target: r.target,
                targetVal: r.targetVal,
                realisasi: r.realisasi,
                realisasiVal: r.realisasiVal,
                capaian: r.capaian,
                capaianVal: r.capaianVal,
                status: r.status,
                tahun: r.tahun,
                timeline: S2_TIMELINES[grp] || S2_TIMELINES.kemantapan,
                tableRows: [r]
            };
        });
    }

    function getSasaran2IndicatorLabel(rowOrName) {
        const name = (typeof rowOrName === 'string') ? rowOrName : (rowOrName && rowOrName.name);
        const grp = getS2GroupKey(name);
        if (grp === 'kemantapan') return 'Indikator 1';
        if (grp === 'lebar_teknis') return 'Indikator 2';
        if (grp === 'pelayanan') return 'Indikator 3';
        if (grp === 'konektivitas') return 'Indikator 4';
        return '';
    }

    function renderSasaran2MultiSection(activeYear = 'all') {
        const container = document.getElementById('sasaran-2-multi-container');
        if (!container) return;

        // Destroy previous Sasaran 2 chart instances
        if (state.charts && state.charts.sasaran2Charts && state.charts.sasaran2Charts.length > 0) {
            state.charts.sasaran2Charts.forEach(c => { if (c) c.destroy(); });
        }
        if (!state.charts) state.charts = {};
        state.charts.sasaran2Charts = [];

        const indicators = getSasaran2IndicatorsList(activeYear);
        if (!indicators || indicators.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Tidak ada data indikator Sasaran 2 untuk tahun terpilih.</div>';
            return;
        }

        let html = '';
        indicators.forEach((item, idx) => {
            html += buildS2IndicatorBlockHtml(item, idx, activeYear, indicators.length);
        });
        // Tambahkan satu tabel daftar indikator gabungan di paling bawah
        html += buildS2UnifiedTableHtml(activeYear);
        container.innerHTML = html;

        // Inisialisasi Chart.js untuk setiap indikator
        indicators.forEach((item, idx) => {
            const barChart = initS2BarChart('chartS2Bar_' + idx, item.timeline, activeYear);
            if (barChart) state.charts.sasaran2Charts.push(barChart);

            const numericCap = (item.capaianVal !== undefined && item.capaianVal !== null && !isNaN(item.capaianVal)) ? item.capaianVal : 0;
            const gaugeChart = initS2GaugeChart('chartS2Gauge_' + idx, numericCap);
            if (gaugeChart) state.charts.sasaran2Charts.push(gaugeChart);
        });
    }

    function buildS2IndicatorBlockHtml(item, idx, activeYear, totalCount) {
        const isRpd = (item.tahun && item.tahun.includes('RPD')) || activeYear === '2025 RPD' || activeYear === '2025 (RPD)';
        const tahunLabel = (activeYear === 'all') ? '2019 - 2030' : (item.tahun || activeYear);
        const targetDisplay = item.target || '-';
        const realisasiDisplay = (item.realisasi && item.realisasi !== '-') ? item.realisasi : '-';
        const capaianDisplay = (item.capaian && item.capaian !== '-') ? item.capaian : '-';
        const hasRealisasi = (realisasiDisplay !== '-');

        let diffText = '-';
        let numericCapaian = (item.capaianVal !== undefined && item.capaianVal !== null && !isNaN(item.capaianVal)) ? item.capaianVal : 0;
        if (hasRealisasi && item.realisasiVal !== undefined && item.targetVal !== undefined) {
            const diff = item.realisasiVal - item.targetVal;
            diffText = (diff >= 0 ? '+' : '') + diff.toFixed(2).replace('.', ',') + (item.satuan || '%');
        }

        let card4Theme = 'slate';
        let card4Icon = 'bi-hourglass-split';
        let card4Badge = '<i class="bi bi-clock-history me-1"></i>Belum Ada Realisasi';
        let statusTitle = 'Belum Ada Realisasi';
        let kategoriText = 'Belum Ada Realisasi';
        let statusIcon = 'bi-hourglass-split';
        let statusTheme = 'secondary';
        let boxBg = '#f8fafc';
        let boxBorder = '#e2e8f0';
        let progressPct = 0;

        if (hasRealisasi) {
            if (numericCapaian > 100) {
                card4Theme = 'sapphire';
                card4Icon = 'bi-trophy-fill';
                card4Badge = '<i class="bi bi-stars me-1"></i>Melampaui Target';
                statusTitle = 'Melebihi Target';
                kategoriText = 'Sangat Baik';
                statusIcon = 'bi-check-all';
                statusTheme = 'primary';
                boxBg = '#eff6ff';
                boxBorder = '#bfdbfe';
                progressPct = 100;
            } else if (numericCapaian === 100) {
                card4Theme = 'emerald';
                card4Icon = 'bi-check-circle-fill';
                card4Badge = '<i class="bi bi-check2-circle me-1"></i>Target Tercapai';
                statusTitle = 'Mencapai Target';
                kategoriText = 'Baik';
                statusIcon = 'bi-check-circle-fill';
                statusTheme = 'success';
                boxBg = '#f0fdf4';
                boxBorder = '#bbf7d0';
                progressPct = 100;
            } else {
                card4Theme = 'ruby';
                card4Icon = 'bi-exclamation-triangle-fill';
                card4Badge = '<i class="bi bi-exclamation-circle-fill me-1"></i>Tidak Tercapai';
                statusTitle = 'Tidak Tercapai';
                kategoriText = 'Kurang';
                statusIcon = 'bi-exclamation-circle';
                statusTheme = 'danger';
                boxBg = '#fef2f2';
                boxBorder = '#fecaca';
                progressPct = Math.min(100, Math.round(numericCapaian));
            }
        }

        const card4Classes = {
            sapphire: { card: 'kinerja-card-cobalt', iconWrap: 'icon-cobalt', bar: 'bar-cobalt', badge: 'bg-cobalt-subtle text-cobalt border-cobalt-subtle' },
            emerald: { card: 'kinerja-card-emerald', iconWrap: 'icon-emerald', bar: 'bar-emerald', badge: 'bg-success-subtle text-success border-success-subtle' },
            ruby: { card: 'kinerja-card-ruby', iconWrap: 'icon-ruby', bar: 'bar-ruby', badge: 'bg-danger-subtle text-danger border-danger-subtle' },
            slate: { card: 'kinerja-card-slate', iconWrap: 'icon-slate', bar: 'bar-slate', badge: 'bg-secondary-subtle text-secondary border-secondary-subtle' }
        }[card4Theme];

        const cardTitleTarget = (activeYear === 'all') ? 'RATA-RATA TARGET INDIKATOR' : 'TARGET INDIKATOR';
        const cardTitleReal = (activeYear === 'all') ? 'RATA-RATA REALISASI INDIKATOR' : 'REALISASI INDIKATOR';
        const cardTitleCap = (activeYear === 'all') ? 'RATA-RATA CAPAIAN INDIKATOR' : 'CAPAIAN INDIKATOR';

        return `
        <div class="sasaran2-indicator-block mb-4 p-3.5 border rounded-3 bg-white shadow-2xs">
            <!-- Header Indikator -->
            <div class="d-flex align-items-center justify-content-between mb-3 pb-2.5 border-bottom flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-primary text-white px-2.5 py-1 rounded-pill fw-bold" style="font-size: 0.76rem;">
                        Indikator ${idx + 1} dari ${totalCount}
                    </span>
                    <h5 class="h6 fw-bold text-dark mb-0">${item.displayName || item.name}</h5>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-light text-secondary border px-2.5 py-1 rounded-pill text-xs fw-semibold">
                        <i class="bi bi-tag me-1"></i>Satuan: ${item.satuan || '%'}
                    </span>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 rounded-pill text-xs fw-semibold">
                        ${activeYear === 'all' ? 'Periode 2019 - 2030' : ('Tahun Anggaran ' + tahunLabel)}
                    </span>
                </div>
            </div>

            <!-- 4 KPI Metrics Card -->
            <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-2.5 mb-3">
                <!-- Card 1: JUMLAH INDIKATOR -->
                <div class="col">
                    <div class="kinerja-pro-card kinerja-card-navy h-100 d-flex flex-column">
                        <div class="kinerja-card-content flex-grow-1 d-flex flex-column">
                            <div class="kinerja-card-header d-flex justify-content-between align-items-center mb-0" style="min-height: 36px;">
                                <span class="kinerja-card-title text-uppercase fw-bold">JUMLAH INDIKATOR</span>
                                <div class="kinerja-card-icon-wrap icon-navy">
                                    <i class="bi bi-layers-half"></i>
                                </div>
                            </div>
                            <div class="kinerja-card-body flex-grow-1 d-flex flex-column justify-content-center">
                                <div class="d-flex align-items-baseline gap-2">
                                    <h3 class="kinerja-card-value fw-bolder mb-0">1</h3>
                                    <span class="kinerja-card-unit text-secondary fw-medium">indikator</span>
                                </div>
                            </div>
                        </div>
                        <div class="kinerja-card-bottom mt-auto">
                            <div class="kinerja-mini-progress">
                                <div class="kinerja-mini-progress-bar bar-navy" style="width: 100%;"></div>
                            </div>
                            <div class="kinerja-card-footer d-flex align-items-center justify-content-between" style="min-height: 52px;">
                                <span class="badge bg-navy-subtle text-navy border border-navy-subtle rounded-pill px-2 py-0.5 flex-shrink-0" style="font-size: 0.68rem;">
                                    <i class="bi bi-check-circle-fill me-1"></i>Indikator Sasaran 2
                                </span>
                                <span class="text-secondary fw-semibold text-end ms-2" style="font-size: 0.70rem; line-height: 1.25; word-break: break-word;" title="${item.name}">
                                    ${item.name}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 2: TARGET INDIKATOR -->
                <div class="col">
                    <div class="kinerja-pro-card kinerja-card-sky h-100 d-flex flex-column">
                        <div class="kinerja-card-content flex-grow-1 d-flex flex-column">
                            <div class="kinerja-card-header d-flex justify-content-between align-items-center mb-0" style="min-height: 36px;">
                                <span class="kinerja-card-title text-uppercase fw-bold">${cardTitleTarget}</span>
                                <div class="kinerja-card-icon-wrap icon-sky">
                                    <i class="bi bi-bullseye"></i>
                                </div>
                            </div>
                            <div class="kinerja-card-body flex-grow-1 d-flex flex-column justify-content-center">
                                <div class="d-flex align-items-baseline gap-2">
                                    <h3 class="kinerja-card-value fw-bolder mb-0">${targetDisplay}</h3>
                                    <span class="kinerja-card-unit text-secondary fw-medium">${item.satuan || '%'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="kinerja-card-bottom mt-auto">
                            <div class="kinerja-mini-progress">
                                <div class="kinerja-mini-progress-bar bar-sky" style="width: 100%;"></div>
                            </div>
                            <div class="kinerja-card-footer d-flex align-items-center justify-content-between" style="min-height: 52px;">
                                <span class="badge bg-sky-subtle text-sky border border-sky-subtle rounded-pill px-2 py-0.5 flex-shrink-0" style="font-size: 0.68rem;">
                                    <i class="bi bi-file-earmark-text me-1"></i>${isRpd ? 'Dokumen RPD' : 'Dokumen Renja'}
                                </span>
                                <span class="text-muted fw-medium text-end ms-2" style="font-size: 0.68rem; line-height: 1.25;">Tahun Anggaran ${tahunLabel}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 3: REALISASI INDIKATOR -->
                <div class="col">
                    <div class="kinerja-pro-card kinerja-card-cyan h-100 d-flex flex-column">
                        <div class="kinerja-card-content flex-grow-1 d-flex flex-column">
                            <div class="kinerja-card-header d-flex justify-content-between align-items-center mb-0" style="min-height: 36px;">
                                <span class="kinerja-card-title text-uppercase fw-bold">${cardTitleReal}</span>
                                <div class="kinerja-card-icon-wrap icon-cyan">
                                    <i class="bi bi-award-fill"></i>
                                </div>
                            </div>
                            <div class="kinerja-card-body flex-grow-1 d-flex flex-column justify-content-center">
                                <div class="d-flex align-items-baseline gap-2">
                                    <h3 class="kinerja-card-value fw-bolder mb-0">${realisasiDisplay}</h3>
                                    <span class="kinerja-card-unit text-secondary fw-medium">${hasRealisasi ? (item.satuan || '%') : 'Belum Ada Realisasi'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="kinerja-card-bottom mt-auto">
                            <div class="kinerja-mini-progress">
                                <div class="kinerja-mini-progress-bar bar-cyan" style="width: ${hasRealisasi ? '100%' : '0%'};"></div>
                            </div>
                            <div class="kinerja-card-footer d-flex align-items-center justify-content-between" style="min-height: 52px;">
                                <span class="badge bg-cyan-subtle text-cyan border border-cyan-subtle rounded-pill px-2 py-0.5 flex-shrink-0" style="font-size: 0.68rem;">
                                    ${hasRealisasi ? `<i class="bi bi-check2-circle me-1"></i>${diffText} dari target` : '<i class="bi bi-hourglass-split me-1"></i>Belum Ada Realisasi'}
                                </span>
                                <span class="text-muted fw-medium text-end ms-2" style="font-size: 0.68rem; line-height: 1.25;">${hasRealisasi ? 'Dokumen LKPJ' : 'Menunggu Pelaporan'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 4: CAPAIAN INDIKATOR -->
                <div class="col">
                    <div class="kinerja-pro-card ${card4Classes.card} h-100 d-flex flex-column">
                        <div class="kinerja-card-content flex-grow-1 d-flex flex-column">
                            <div class="kinerja-card-header d-flex justify-content-between align-items-center mb-0" style="min-height: 36px;">
                                <span class="kinerja-card-title text-uppercase fw-bold">${cardTitleCap}</span>
                                <div class="kinerja-card-icon-wrap ${card4Classes.iconWrap}">
                                    <i class="bi ${card4Icon}"></i>
                                </div>
                            </div>
                            <div class="kinerja-card-body flex-grow-1 d-flex flex-column justify-content-center">
                                <div class="d-flex align-items-baseline gap-2">
                                    <h3 class="kinerja-card-value fw-bolder mb-0">${capaianDisplay}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="kinerja-card-bottom mt-auto">
                            <div class="kinerja-mini-progress">
                                <div class="kinerja-mini-progress-bar ${card4Classes.bar}" style="width: ${progressPct}%;"></div>
                            </div>
                            <div class="kinerja-card-footer d-flex align-items-center justify-content-between" style="min-height: 52px;">
                                <span class="badge ${card4Classes.badge} border rounded-pill px-2 py-0.5 flex-shrink-0" style="font-size: 0.68rem;">
                                    ${card4Badge}
                                </span>
                                <span class="text-secondary fw-semibold text-end ms-2" style="font-size: 0.68rem; line-height: 1.25;">Kategori ${kategoriText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Visualisasi Grafik (Perbandingan Col 8 & Gauge Col 4) -->
            <div class="row g-4 mb-3">
                <!-- Kiri: Perbandingan Target dan Realisasi (Col 8) -->
                <div class="col-12 col-xl-8">
                    <div class="border rounded-3 p-3 bg-white h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <h4 class="h6 fw-bold text-dark mb-0">
                                <i class="bi bi-bar-chart-fill me-2 text-warning"></i> <span>Perbandingan Target dan Realisasi Indikator</span>
                            </h4>
                            <div class="d-flex align-items-center gap-3 text-xs">
                                <div class="d-flex align-items-center gap-1.5">
                                    <span class="rounded-circle d-inline-block" style="width: 10px; height: 10px; background-color: #f59e0b;"></span>
                                    <span class="text-secondary fw-semibold">Target</span>
                                </div>
                                <div class="d-flex align-items-center gap-1.5">
                                    <span class="rounded-circle d-inline-block" style="width: 10px; height: 10px; background-color: #10b981;"></span>
                                    <span class="text-secondary fw-semibold">Realisasi</span>
                                </div>
                                <div class="d-flex align-items-center gap-1.5">
                                    <span class="rounded-circle d-inline-block" style="width: 10px; height: 10px; background-color: #2563eb;"></span>
                                    <span class="text-secondary fw-semibold">Capaian (%)</span>
                                </div>
                            </div>
                        </div>
                        <div style="height: 290px; position: relative;">
                            <canvas id="chartS2Bar_${idx}"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Kanan: Capaian Kinerja Semi-Donut Gauge (Col 4) -->
                <div class="col-12 col-xl-4">
                    <div class="border rounded-3 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-3">
                                <h4 class="h6 fw-bold text-dark mb-0">
                                    <i class="bi bi-graph-up me-2 text-primary"></i> <span>Capaian Kinerja Indikator</span>
                                </h4>
                            </div>
                            <div class="row align-items-center g-3 my-2 mb-3">
                                <div class="col-12 col-sm-6 d-flex justify-content-center">
                                    <div class="kinerja-gauge-wrapper position-relative" style="width: 175px; height: 110px;">
                                        <canvas id="chartS2Gauge_${idx}"></canvas>
                                        <div class="kinerja-gauge-center-info">
                                            <div class="kinerja-gauge-pct">${capaianDisplay}</div>
                                            <div class="kinerja-gauge-label" style="color: ${card4Theme === 'ruby' ? '#dc2626' : (card4Theme === 'emerald' ? '#16a34a' : '#2563eb')};">${kategoriText}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-12 col-sm-6 d-flex align-items-center justify-content-center justify-content-sm-start">
                                    <div class="kinerja-status-box p-3 rounded-2 shadow-xs w-100" style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; width: 100%;">
                                        <div class="d-flex align-items-start" style="gap: 12px;">
                                            <div class="flex-shrink-0 d-flex align-items-center justify-content-center" style="height: 1.25rem;">
                                                <i class="bi ${statusIcon} text-${statusTheme} fs-5" style="line-height: 1;"></i>
                                            </div>
                                            <div class="d-flex flex-column justify-content-center">
                                                <div class="fw-bold text-${statusTheme}" style="font-size: 0.825rem; line-height: 1.25rem;">${statusTitle}</div>
                                                <div class="text-secondary" style="font-size: 0.825rem; line-height: 1.25rem; margin-top: 6px;">
                                                    ${hasRealisasi ? `dengan selisih <strong class="text-dark fw-bold">${diffText}</strong>` : `<span class="text-muted">belum ada data realisasi</span>`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="d-flex align-items-start p-3 rounded-3" style="background-color: #eff6ff; border: 1px solid #dbeafe; margin-top: 2.25rem; gap: 12px;">
                                <i class="bi bi-info-circle-fill text-primary fs-6 flex-shrink-0" style="margin-top: 1px;"></i>
                                <span class="text-xs text-secondary" style="line-height: 1.45;">
                                    ${hasRealisasi 
                                        ? `Capaian <strong>${item.name}</strong> pada Tahun <strong>${tahunLabel}</strong> sebesar <strong>${capaianDisplay}</strong> berada pada kategori <strong>${kategoriText}</strong>.`
                                        : `Target kinerja <strong>${item.name}</strong> Tahun <strong>${tahunLabel}</strong> adalah <strong>${targetDisplay}</strong> dan belum memiliki data realisasi.`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    function buildS2UnifiedTableHtml(activeYear = 'all') {
        const allSasaran = (KINERJA_HIERARCHY_DATA && KINERJA_HIERARCHY_DATA.sasaran && KINERJA_HIERARCHY_DATA.sasaran.tableData) || [];
        let rows = allSasaran.filter(r => r.jenisSasaran === 'Sasaran 2');

        if (activeYear && activeYear !== 'all') {
            const matchedRows = rows.filter(r => isKinerjaYearMatch(r.tahun, activeYear));
            if (matchedRows.length > 0) {
                rows = matchedRows;
            }
        }

        const S2_ORDER = { 'kemantapan': 1, 'lebar_teknis': 2, 'pelayanan': 3, 'konektivitas': 4 };
        rows = [...rows].sort((a, b) => {
            const yrA = (a.tahun || '').replace(/[^0-9]/g, '');
            const yrB = (b.tahun || '').replace(/[^0-9]/g, '');
            if (yrA !== yrB) return yrA.localeCompare(yrB);
            return (S2_ORDER[getS2GroupKey(a.name)] || 99) - (S2_ORDER[getS2GroupKey(b.name)] || 99);
        });

        const tableCardTitle = (activeYear === 'all')
            ? 'Daftar Indikator Sasaran 2 (Periode 2019 - 2030)'
            : `Daftar Indikator Sasaran 2 Tahun Anggaran ${activeYear}`;

        const rowsHtml = rows.map((r, rIdx) => {
            let statusBadgeClass = 'bg-secondary-subtle text-secondary border-secondary-subtle';
            let statusIcon = 'bi-hourglass-split';
            const sLow = (r.status || '').toLowerCase();
            if (sLow.includes('tercapai') || sLow.includes('mencapai')) {
                statusBadgeClass = 'bg-success-subtle text-success border-success-subtle';
                statusIcon = 'bi-check-circle-fill';
            } else if (sLow.includes('melebihi')) {
                statusBadgeClass = 'bg-primary-subtle text-primary border-primary-subtle';
                statusIcon = 'bi-check-all';
            } else if (sLow.includes('tidak tercapai')) {
                statusBadgeClass = 'bg-danger-subtle text-danger border-danger-subtle';
                statusIcon = 'bi-x-circle-fill';
            }

            let yrBadge = `<span class="badge bg-light text-secondary border border-light-subtle px-2 py-1 fw-semibold" style="font-size: 0.72rem;">${r.tahun || activeYear}</span>`;
            if (r.tahun && r.tahun.includes('RPD')) {
                yrBadge = `
                    <div class="d-inline-flex align-items-center justify-content-center gap-1">
                        <span class="badge bg-light text-secondary border border-light-subtle px-2 py-1 fw-semibold" style="font-size: 0.72rem;">2025</span>
                        <span class="badge bg-light text-secondary border border-light-subtle fw-semibold px-1.5 py-0.5 rounded" style="font-size: 0.62rem; color: #64748b;" title="Rencana Pembangunan Daerah">RPD</span>
                    </div>
                `;
            }

            return `
                <tr>
                    <td class="text-center fw-bold text-muted">${rIdx + 1}</td>
                    <td class="text-center">${yrBadge}</td>
                    <td>
                        <div class="d-flex flex-column gap-1">
                            <div class="d-flex align-items-center flex-wrap gap-1">
                                <span class="badge bg-emerald-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill fw-bold" style="font-size: 0.68rem;">Sasaran 2</span>
                                <span class="badge bg-light text-secondary border border-light-subtle px-2 py-0.5 rounded-pill fw-semibold ms-1" style="font-size: 0.68rem;">${getSasaran2IndicatorLabel(r)}</span>
                            </div>
                            <span class="fw-semibold text-dark" style="font-size: 0.85rem; line-height: 1.35;">${r.name}</span>
                        </div>
                    </td>
                    <td class="text-center"><span class="badge bg-light text-secondary border px-2 py-1 fw-semibold" style="font-size: 0.72rem;">${r.satuan || '%'}</span></td>
                    <td class="text-center fw-bold text-dark">${r.target}</td>
                    <td class="text-center fw-bold text-dark">${r.realisasi}</td>
                    <td class="text-center fw-bold text-dark">${r.capaian}</td>
                    <td class="text-center">
                        <span class="badge ${statusBadgeClass} border px-2.5 py-1 rounded-pill fw-semibold text-xs d-inline-flex align-items-center gap-1">
                            <i class="bi ${statusIcon}"></i> ${r.status}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        return `
        <!-- Tabel Tunggal Daftar Data Indikator Sasaran 2 (Di Paling Bawah) -->
        <div class="border rounded-3 p-3 bg-white mb-4 shadow-2xs">
            <div class="border-bottom pb-3 mb-3">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <h4 class="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <i class="bi bi-list-task text-primary"></i> <span>${tableCardTitle}</span>
                    </h4>
                    <span class="badge bg-light text-secondary border px-2.5 py-1 rounded-pill text-xs fw-semibold">
                        Total: ${rows.length} Indikator
                    </span>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table custom-table table-hover align-middle mb-0 text-xs">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 50px;">No.</th>
                            <th class="text-center" style="width: 100px;">Tahun</th>
                            <th style="min-width: 260px;">Indikator Sasaran 2</th>
                            <th class="text-center" style="width: 90px;">Satuan</th>
                            <th class="text-center" style="width: 110px;">Target</th>
                            <th class="text-center" style="width: 110px;">Realisasi</th>
                            <th class="text-center" style="width: 110px;">Capaian</th>
                            <th class="text-center" style="width: 140px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 pt-3 border-top text-xs text-muted">
                <div>Menampilkan 1 - ${rows.length} dari ${rows.length} data</div>
            </div>
        </div>
        `;
    }

    function initS2BarChart(canvasId, timeline, activeYear) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');

        const chartLabels = timeline.labels;
        const targets = timeline.targets;
        const realisasis = timeline.realisasis;
        const capaians = timeline.capaians;

        const yearLabelMap = {
            '2019': 0, '2020': 1, '2021': 2, '2022': 3, '2023': 4, '2024': 5,
            '2025 RPD': 6, '2025 (RPD)': 6, '2025': 7,
            '2026': 8, '2027': 9, '2028': 10, '2029': 11, '2030': 12
        };
        const activeIdx = yearLabelMap[activeYear] !== undefined ? yearLabelMap[activeYear] : -1;

        // Visual bar height offset: apabila label nilai barchart naik, fisik bar chart juga ikut dinaikkan
        const visualTargets = [...targets];
        const visualRealisasis = [...realisasis];

        targets.forEach((tgt, idx) => {
            const rel = realisasis[idx];
            if (tgt !== null && tgt !== undefined && !isNaN(tgt) && rel !== null && rel !== undefined && !isNaN(rel)) {
                const diff = rel - tgt;
                // Jika nilai target dan realisasi sama atau sangat dekat (< 3%)
                if (Math.abs(diff) < 3.0) {
                    // Naikkan grafik barchart Target (+6.0) agar fisik bar ikut naik bersama labelnya
                    visualTargets[idx] = tgt + 6.0;
                }
            }
        });

        // Warna bar Target dan Realisasi (gaya Sasaran 1)
        const targetColors = chartLabels.map((_, i) => (activeIdx === -1 || activeIdx === i) ? '#f59e0b' : 'rgba(245, 158, 11, 0.28)');
        const targetBorders = chartLabels.map((_, i) => (activeIdx === -1 || activeIdx === i) ? '#d97706' : 'rgba(217, 119, 6, 0.25)');
        const realisasiColors = chartLabels.map((_, i) => (activeIdx === -1 || activeIdx === i) ? '#10b981' : 'rgba(16, 185, 129, 0.28)');
        const realisasiBorders = chartLabels.map((_, i) => (activeIdx === -1 || activeIdx === i) ? '#047857' : 'rgba(4, 120, 87, 0.25)');

        // Style titik Line Chart persis Sasaran 1 (lingkaran putih dengan border biru, titik aktif terisi biru penuh)
        const pointRadii = chartLabels.map((_, i) => (activeIdx !== -1 && activeIdx === i) ? 7.5 : 4.5);
        const pointBg = chartLabels.map((_, i) => (activeIdx !== -1 && activeIdx === i) ? '#2563eb' : '#ffffff');
        const pointBorder = chartLabels.map((_, i) => (activeIdx !== -1 && activeIdx === i) ? '#ffffff' : '#2563eb');
        const pointBorderW = chartLabels.map((_, i) => (activeIdx !== -1 && activeIdx === i) ? 3.5 : 2.5);

        // Skala dan penyesuaian khusus:
        const isPelayanan = (timeline.key === 'pelayanan') || 
            (timeline.defaultName && (timeline.defaultName.toLowerCase().includes('pelayanan') || timeline.defaultName.toLowerCase().includes('rvk') || timeline.defaultName.toLowerCase().includes('los')));

        const isLebarTeknis = (timeline.key === 'lebar_teknis') || 
            (timeline.defaultName && (timeline.defaultName.toLowerCase().includes('lebar') || timeline.defaultName.toLowerCase().includes('teknis')));

        const validBars = [...visualTargets, ...visualRealisasis].filter(v => v !== null && v !== undefined && !isNaN(v));
        const maxBarVal = validBars.length > 0 ? Math.max(...validBars) : 100;

        let yMax = 185;
        let y1Min = -30;
        let y1Max = 125;

        if (isPelayanan) {
            // Menaikkan posisi line chart pada indikator pelayanan
            yMax = 220;      // Bar chart tetap berada di bawah (maksimal ~40% tinggi kanvas)
            y1Min = -240;    // Skala dasar digeser sehingga capaian 94%-100% melayang di ~68%-70% kanvas
            y1Max = 250;     // Puncak 215.74% tetap aman di ~93% kanvas
        } else if (isLebarTeknis) {
            // Meninggikan bar chart pada indikator Lebar Jalan Standar / Persyaratan Teknis (nilai bar 48% - 63%)
            // agar proporsional dan gap dengan line chart tidak terlalu jauh
            yMax = 108;      // Menurunkan batas atas skala Y sehingga bar chart mencapai ~55% - 64% tinggi kanvas
            y1Min = -20;     // Menjaga line chart tetap melayang di area atas (~77% - 88% tinggi kanvas)
            y1Max = 135;
        } else {
            yMax = Math.max(185, Math.ceil(maxBarVal * 1.85));
            y1Min = -30;
            y1Max = 125;
        }

        const datasets = [
            {
                type: 'line',
                label: 'Capaian (%)',
                data: capaians,
                rawValues: capaians,
                borderColor: '#2563eb',
                borderWidth: 2.5,
                backgroundColor: '#ffffff',
                fill: false,
                tension: 0.25,
                yAxisID: 'y1',
                order: 1,
                pointRadius: pointRadii,
                pointHoverRadius: 8,
                pointBackgroundColor: pointBg,
                pointBorderColor: pointBorder,
                pointBorderWidth: pointBorderW,
                pointHoverBorderWidth: 3
            },
            {
                type: 'bar',
                label: 'Target',
                data: visualTargets,
                rawValues: targets,
                backgroundColor: targetColors,
                borderColor: targetBorders,
                hoverBackgroundColor: '#d97706',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.60,
                categoryPercentage: 0.85,
                order: 2
            },
            {
                type: 'bar',
                label: 'Realisasi',
                data: visualRealisasis,
                rawValues: realisasis,
                backgroundColor: realisasiColors,
                borderColor: realisasiBorders,
                hoverBackgroundColor: '#059669',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.60,
                categoryPercentage: 0.85,
                order: 2
            }
        ];

        const dataLabelsPlugin = {
            id: 's2DataLabels_' + canvasId,
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const targetDatasetIndex = chart.data.datasets.findIndex(d => d.label === 'Target');
                const realisasiDatasetIndex = chart.data.datasets.findIndex(d => d.label === 'Realisasi');
                const lineDatasetIndex = chart.data.datasets.findIndex(d => d.type === 'line' || (d.label && d.label.includes('Capaian')));

                const targetMeta = targetDatasetIndex !== -1 ? chart.getDatasetMeta(targetDatasetIndex) : null;
                const realisasiMeta = realisasiDatasetIndex !== -1 ? chart.getDatasetMeta(realisasiDatasetIndex) : null;
                const lineMeta = lineDatasetIndex !== -1 ? chart.getDatasetMeta(lineDatasetIndex) : null;

                // 1. Gambar Label Bar Chart (Target dan Realisasi duduk tepat di atas bar masing-masing)
                chartLabels.forEach((_, index) => {
                    const isYearMatched = (activeIdx === -1 || activeIdx === index);
                    const targetEl = (targetMeta && targetMeta.data) ? targetMeta.data[index] : null;
                    const realEl = (realisasiMeta && realisasiMeta.data) ? realisasiMeta.data[index] : null;

                    const rawTgt = targets[index];
                    const rawRel = realisasis[index];

                    const hasTgt = rawTgt !== null && rawTgt !== undefined && !isNaN(rawTgt) && targetEl;
                    const hasRel = rawRel !== null && rawRel !== undefined && !isNaN(rawRel) && realEl;

                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';

                    // Helper format angka presisi penuh (misal 86,51%, 86,45%, 100%)
                    const formatPreciseVal = (v) => {
                        if (v === null || v === undefined || isNaN(v)) return '';
                        return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)).replace('.', ',') + '%';
                    };

                    // Label Target (duduk langsung di atas bar Target yang tingginya mengikuti visual)
                    if (hasTgt) {
                        ctx.font = isYearMatched ? '700 8.5px Poppins, -apple-system, sans-serif' : '500 8px Poppins, -apple-system, sans-serif';
                        const valText = formatPreciseVal(rawTgt);
                        const tw = ctx.measureText(valText).width;

                        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                        ctx.fillRect(targetEl.x - (tw / 2) - 1.5, targetEl.y - 12, tw + 3, 10);

                        ctx.fillStyle = isYearMatched ? '#b45309' : 'rgba(217, 119, 6, 0.6)';
                        ctx.fillText(valText, targetEl.x, targetEl.y - 3);
                    }

                    // Label Realisasi (duduk langsung di atas bar Realisasi)
                    if (hasRel) {
                        ctx.font = isYearMatched ? '700 8.5px Poppins, -apple-system, sans-serif' : '500 8.5px Poppins, -apple-system, sans-serif';
                        const valText = formatPreciseVal(rawRel);
                        const tw = ctx.measureText(valText).width;

                        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                        ctx.fillRect(realEl.x - (tw / 2) - 1.5, realEl.y - 12, tw + 3, 10);

                        ctx.fillStyle = isYearMatched ? '#047857' : 'rgba(5, 150, 105, 0.6)';
                        ctx.fillText(valText, realEl.x, realEl.y - 3);
                    }

                    ctx.restore();
                });

                // 2. Gambar Label Line Chart Capaian
                if (lineMeta && lineMeta.data) {
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';

                    lineMeta.data.forEach((element, index) => {
                        const rawCap = capaians[index];
                        if (rawCap === null || rawCap === undefined || isNaN(rawCap)) return;

                        const isYearMatched = (activeIdx === -1 || activeIdx === index);
                        ctx.font = isYearMatched ? '800 10.5px Poppins, -apple-system, sans-serif' : '600 9px Poppins, -apple-system, sans-serif';
                        ctx.fillStyle = isYearMatched ? '#1d4ed8' : '#93c5fd';
                        const valText = (rawCap % 1 === 0 ? rawCap.toFixed(0) : rawCap.toFixed(2)).replace('.', ',') + '%';
                        ctx.fillText(valText, element.x, element.y - (isYearMatched ? 8 : 6));
                    });

                    ctx.restore();
                }
            }
        };

        return new Chart(ctx, {
            data: {
                labels: chartLabels,
                datasets: datasets
            },
            plugins: [dataLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 25, bottom: 0, left: 5, right: 5 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const rawVal = context.dataset.rawValues ? context.dataset.rawValues[context.dataIndex] : context.raw;
                                if (rawVal === null || rawVal === undefined) return ` ${context.dataset.label}: -`;
                                return ` ${context.dataset.label}: ${rawVal.toFixed(2).replace('.', ',')}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            font: { size: 10, weight: '600' },
                            color: function(context) {
                                return (activeIdx !== -1 && context.index === activeIdx) ? '#1e293b' : '#64748b';
                            }
                        }
                    },
                    y: {
                        position: 'left',
                        display: false,
                        grid: { display: false },
                        ticks: { display: false },
                        border: { display: false },
                        beginAtZero: true,
                        max: yMax
                    },
                    y1: {
                        position: 'right',
                        display: false,
                        grid: { display: false },
                        ticks: { display: false },
                        border: { display: false },
                        min: y1Min,
                        max: y1Max
                    }
                }
            }
        });
    }

    function initS2GaugeChart(canvasId, capaianPct) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');

        const numericCap = (typeof capaianPct === 'number' && !isNaN(capaianPct)) ? capaianPct : 0;
        const arcValue = Math.min(Math.max(numericCap, 0), 100);
        const arcRemaining = Math.max(100 - arcValue, 0);

        let activeColor = '#2563eb';
        if (numericCap === 0) activeColor = '#cbd5e1';
        else if (numericCap > 100) activeColor = '#2563eb';
        else if (numericCap === 100) activeColor = '#10b981';
        else activeColor = '#ef4444';

        const arcColors = [activeColor, '#e2e8f0'];

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [arcValue, arcRemaining],
                    backgroundColor: arcColors,
                    borderWidth: 0,
                    borderRadius: arcRemaining === 0 ? 10 : [10, 0]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                circumference: 180,
                rotation: -90,
                cutout: '76%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }


    // Main Renderer for Target Kinerja Tab
    function renderTargetKinerjaTab() {
        const level = targetKinerjaState.activeLevel || 'tujuan';
        const activeYear = (state && state.activeFilters && state.activeFilters.tahun) ? state.activeFilters.tahun : 'all';

        const isTujuan = (level === 'tujuan');
        const isSasaran = (level === 'sasaran');
        const activeSasaranTab = targetKinerjaState.activeSasaranTab || 'all';

        // Toggle Sub-Tabs khusus bagian Sasaran (Semua Sasaran | Sasaran 1 | Sasaran 2)
        const elSasaranSubtabsContainer = document.getElementById('sasaran-subtabs-container');
        if (elSasaranSubtabsContainer) {
            if (isSasaran) {
                elSasaranSubtabsContainer.classList.remove('d-none');
            } else {
                elSasaranSubtabsContainer.classList.add('d-none');
            }
        }

        // Update active class pada tombol sub-tabs Sasaran
        const tabAllBtn = document.getElementById('tab-sasaran-all');
        const tab1Btn = document.getElementById('tab-sasaran-1');
        const tab2Btn = document.getElementById('tab-sasaran-2');
        if (tabAllBtn) tabAllBtn.classList.toggle('active', activeSasaranTab === 'all');
        if (tab1Btn) tab1Btn.classList.toggle('active', activeSasaranTab === 'Sasaran 1');
        if (tab2Btn) tab2Btn.classList.toggle('active', activeSasaranTab === 'Sasaran 2');

        let currentData;
        if (isTujuan) {
            currentData = KINERJA_HIERARCHY_DATA.tujuan;
        } else if (isSasaran) {
            currentData = KINERJA_HIERARCHY_DATA.sasaran;
        } else {
            const yearData = KINERJA_HIERARCHY_DATA.years[activeYear] || KINERJA_HIERARCHY_DATA.years['2025'];
            currentData = yearData[level] || yearData.sasaran;
        }

        // Data Tujuan untuk tahun aktif
        const yearMetrics = TUJUAN_YEAR_DATA[activeYear] || {
            targetText: '0,738',
            realisasiText: '0,780',
            capaianText: '106,60%',
            capaianPct: 106.60,
            statusText: 'Melebihi Target',
            statusDiff: '+6,60%',
            kategoriText: 'Sangat Baik'
        };

        const sasaranYearMetrics = SASARAN_YEAR_DATA[activeYear] || SASARAN_YEAR_DATA['all'];

        // Hitung baris data Sasaran berdasarkan tahun dan sub-tab
        const allSasaranRows = (KINERJA_HIERARCHY_DATA.sasaran && KINERJA_HIERARCHY_DATA.sasaran.tableData) || [];
        const yearSasaranRows = (activeYear === 'all') ? allSasaranRows : allSasaranRows.filter(r => isKinerjaYearMatch(r.tahun, activeYear));

        let displaySasaranRows = yearSasaranRows;
        if (activeSasaranTab === 'Sasaran 1') {
            displaySasaranRows = yearSasaranRows.filter(r => r.jenisSasaran === 'Sasaran 1');
        } else if (activeSasaranTab === 'Sasaran 2') {
            displaySasaranRows = yearSasaranRows.filter(r => r.jenisSasaran === 'Sasaran 2');
        }

        // Update Top 5 Cards counts & Stepper
        const elTujuan = document.getElementById('step-sub-tujuan');
        const elTujuanPct = document.getElementById('step-sub-tujuan-pct');
        const elSasaran = document.getElementById('step-sub-sasaran');
        const elProgram = document.getElementById('step-sub-program');
        const elKegiatan = document.getElementById('step-sub-kegiatan');
        const elSubkegiatan = document.getElementById('step-sub-subkegiatan');

        if (elTujuan) {
            if (activeYear === 'all') {
                const allRows = (KINERJA_HIERARCHY_DATA.tujuan && KINERJA_HIERARCHY_DATA.tujuan.tableData) || [];
                const rowsWithRealisasi = allRows.filter(r => r.realisasi && r.realisasi !== '-' && r.capaian && r.capaian !== '-');
                elTujuan.textContent = `${rowsWithRealisasi.length || 8} Indikator`;
            } else {
                elTujuan.textContent = '1 Indikator';
            }
        }
        if (elTujuanPct) {
            let totalIndikator = 1;
            let tercapaiCount = 0;

            if (activeYear === 'all') {
                const allRows = (KINERJA_HIERARCHY_DATA.tujuan && KINERJA_HIERARCHY_DATA.tujuan.tableData) || [];
                const rowsWithRealisasi = allRows.filter(r => r.realisasi && r.realisasi !== '-' && r.capaian && r.capaian !== '-');
                totalIndikator = rowsWithRealisasi.length || 8;
                tercapaiCount = rowsWithRealisasi.filter(r => {
                    const capNum = parseFloat((r.capaian || '').replace('%', '').replace(',', '.'));
                    return !isNaN(capNum) && capNum >= 100;
                }).length;
            } else {
                totalIndikator = 1;
                const hasRealisasi = (yearMetrics.capaianText !== '-' && yearMetrics.capaianPct > 0);
                tercapaiCount = (hasRealisasi && yearMetrics.capaianPct >= 100) ? 1 : 0;
            }

            elTujuanPct.innerHTML = `<span class="fw-bolder text-danger" style="color: #dc2626 !important; font-weight: 800; font-size: 0.825rem;">${tercapaiCount} dari ${totalIndikator}</span> indikator tercapai`;

            const elTujuanProgress = document.getElementById('step-tujuan-progress');
            if (elTujuanProgress) {
                const pct = totalIndikator > 0 ? (tercapaiCount / totalIndikator) * 100 : 0;
                elTujuanProgress.style.width = `${pct}%`;
                if (tercapaiCount === 0) {
                    elTujuanProgress.className = 'progress-bar bg-danger';
                } else {
                    elTujuanProgress.className = 'progress-bar progress-bar-gradient-blue';
                }
            }
        }
        if (elSasaran) {
            if (activeYear === 'all') {
                elSasaran.textContent = '53 Indikator';
            } else if (activeYear === '2025 RPD' || activeYear === '2025 (RPD)') {
                elSasaran.textContent = '5 Indikator';
            } else if (activeYear === '2025') {
                elSasaran.textContent = '3 Indikator';
            } else if (['2019', '2020', '2021', '2022', '2023', '2024'].includes(activeYear)) {
                elSasaran.textContent = '5 Indikator';
            } else {
                elSasaran.textContent = '3 Indikator';
            }
        }

        // Update Stepper Card Sasaran Sub-text & Progress Bar
        const elSasaranPct = document.getElementById('step-sub-sasaran-pct');
        const elSasaranProgress = document.getElementById('step-sasaran-progress');
        if (elSasaranPct) {
            const allSasaran = (KINERJA_HIERARCHY_DATA.sasaran && KINERJA_HIERARCHY_DATA.sasaran.tableData) || [];
            const targetRows = (activeYear === 'all') ? allSasaran : allSasaran.filter(r => isKinerjaYearMatch(r.tahun, activeYear));
            const totalSasaran = targetRows.length;
            const tercapaiSasaran = targetRows.filter(r => {
                const cap = parseFloat((r.capaian || '').toString().replace('%', '').replace(',', '.'));
                return !isNaN(cap) && cap >= 100;
            }).length;

            const yearLabel = (activeYear === 'all') ? '2019 - 2030' : activeYear;
            const highlightColor = (tercapaiSasaran > 0) ? '#059669' : '#dc2626';
            elSasaranPct.innerHTML = `<span class="fw-bolder" style="color: ${highlightColor}; font-weight: 800; font-size: 0.825rem;">${tercapaiSasaran} dari ${totalSasaran}</span> indikator tercapai`;

            if (elSasaranProgress) {
                const pct = totalSasaran > 0 ? (tercapaiSasaran / totalSasaran) * 100 : 0;
                elSasaranProgress.style.width = `${pct}%`;
                elSasaranProgress.className = tercapaiSasaran === 0 ? 'progress-bar bg-danger' : 'progress-bar progress-bar-gradient-emerald';
            }
        }
        if (elProgram) elProgram.textContent = '8 Indikator';
        if (elKegiatan) elKegiatan.textContent = '18 Indikator';
        if (elSubkegiatan) elSubkegiatan.textContent = '32 Indikator';

        // Update Header Title (Target & Realisasi Kinerja) with Year if filtered & Subtitle
        const targetHeaderTitle = document.getElementById('target-header-title');
        if (targetHeaderTitle) {
            if (activeYear === 'all') {
                targetHeaderTitle.textContent = 'Target & Realisasi Kinerja Tahun 2019 - 2030';
            } else {
                targetHeaderTitle.textContent = `Target & Realisasi Kinerja Tahun ${activeYear}`;
            }
        }

        const targetHeaderSub = document.getElementById('target-header-subtitle');
        if (targetHeaderSub) {
            if (isTujuan) {
                targetHeaderSub.textContent = activeYear === 'all'
                    ? 'Menampilkan data target dan capaian realisasi kinerja indikator tujuan (2019 - 2030)'
                    : `Menampilkan data target dan capaian realisasi kinerja indikator tujuan Tahun ${activeYear}`;
            } else if (isSasaran) {
                const sasaranSubLabel = activeSasaranTab === 'all' ? 'sasaran' : activeSasaranTab.toLowerCase();
                targetHeaderSub.textContent = activeYear === 'all'
                    ? `Menampilkan data target kinerja indikator ${sasaranSubLabel} (2019 - 2030)`
                    : `Menampilkan data target kinerja indikator ${sasaranSubLabel} Tahun ${activeYear}`;
            } else {
                targetHeaderSub.textContent = `Menampilkan data target dan capaian realisasi kinerja indikator ${currentData.title.toLowerCase()} Tahun ${activeYear}`;
            }
        }

        // 1. Update Hero Level Banner
        const heroTitle = document.getElementById('hero-level-title');
        const heroDesc = document.getElementById('hero-level-desc');
        const heroIcon = document.getElementById('hero-level-icon');

        if (heroTitle) {
            if (isSasaran && activeSasaranTab !== 'all') {
                heroTitle.textContent = activeSasaranTab;
            } else {
                heroTitle.textContent = currentData.title;
            }
        }
        if (heroIcon) {
            heroIcon.className = `bi ${currentData.icon}`;
        }
        if (heroDesc) {
            if (isTujuan) {
                heroDesc.innerHTML = TUJUAN_NARRATIVES[activeYear] || TUJUAN_NARRATIVES['all'];
            } else if (isSasaran) {
                if (activeSasaranTab === 'all') {
                    heroDesc.innerHTML = SASARAN_NARRATIVES[activeYear] || SASARAN_NARRATIVES['all'];
                } else if (activeSasaranTab === 'Sasaran 1') {
                    heroDesc.innerHTML = `
                        <div class="mt-1 text-secondary fw-semibold" style="font-size: 0.85rem; line-height: 1.45;">Meningkatnya Akuntabilitas Kinerja Perangkat Daerah</div>
                    `;
                } else if (activeSasaranTab === 'Sasaran 2') {
                    if (activeYear === 'all') {
                        heroDesc.innerHTML = `
                            <div class="d-flex flex-column gap-2 mt-1">
                                <div class="d-flex align-items-baseline gap-2">
                                    <div style="flex: 0 0 160px; width: 160px;">
                                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 2 (2019 - 2020)</span>
                                    </div>
                                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial</div>
                                </div>
                                <div class="d-flex align-items-baseline gap-2">
                                    <div style="flex: 0 0 160px; width: 160px;">
                                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 2 (2021 - 2024)</span>
                                    </div>
                                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar</div>
                                </div>
                                <div class="d-flex align-items-baseline gap-2">
                                    <div style="flex: 0 0 160px; width: 160px;">
                                        <span class="badge bg-emerald-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold w-100 text-center" style="font-size: 0.72rem;">Sasaran 2 (2025 - 2030)</span>
                                    </div>
                                    <div class="text-secondary flex-grow-1" style="font-size: 0.78rem; text-align: justify; line-height: 1.45;">Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar</div>
                                </div>
                            </div>
                        `;
                    } else {
                        const s2Desc = ['2019', '2020'].includes(activeYear)
                            ? 'Terwujudnya Jalan Provinsi yang Aman, Nyaman, dan Lancar serta Meningkatnya Akses Jalan Menuju Kawasan Potensial'
                            : (['2021', '2022', '2023', '2024'].includes(activeYear)
                                ? 'Terwujudnya Jalan Provinsi yang Aman, Nyaman dan Lancar'
                                : 'Mewujudkan Jalan Provinsi yang Aman, Nyaman, dan Lancar' + (activeYear === '2025' ? ' (RPD & Transisi)' : ''));
                        heroDesc.innerHTML = `
                            <div class="d-flex flex-column gap-1 mt-1 text-secondary" style="font-size: 0.8rem; line-height: 1.45;">
                                <div><span class="badge bg-success-subtle text-success border border-success-subtle me-1.5 fw-bold" style="font-size: 0.72rem;">Sasaran 2</span> <strong>${s2Desc}</strong></div>
                            </div>
                        `;
                    }
                }
            } else {
                heroDesc.textContent = currentData.desc;
            }
        }

        // 2. Update 4 KPI Cards (Modern Animated & Colorful Pro Cards)
        const elMetricTitle1 = document.getElementById('metric-title-1');
        const elJumlahIndikator = document.getElementById('metric-jumlah-indikator');
        const elSubtext1 = document.getElementById('metric-subtext-1');
        const elProgressBar1 = document.getElementById('metric-progress-bar-1');
        const elExtraBadge1 = document.getElementById('metric-extra-badge-1');
        const elExtraNote1 = document.getElementById('metric-extra-note-1');

        const elMetricTitle2 = document.getElementById('metric-title-2');
        const elRataTarget = document.getElementById('metric-rata-target');
        const elSubtext2 = document.getElementById('metric-subtext-2');
        const elProgressBar2 = document.getElementById('metric-progress-bar-2');
        const elExtraBadge2 = document.getElementById('metric-extra-badge-2');
        const elExtraNote2 = document.getElementById('metric-extra-note-2');

        const elMetricTitle3 = document.getElementById('metric-title-3');
        const elRataRealisasi = document.getElementById('metric-rata-realisasi');
        const elSubtext3 = document.getElementById('metric-subtext-3');
        const elProgressBar3 = document.getElementById('metric-progress-bar-3');
        const elExtraBadge3 = document.getElementById('metric-extra-badge-3');
        const elExtraNote3 = document.getElementById('metric-extra-note-3');

        const elKinerjaCard4 = document.getElementById('kinerja-card-4');
        const elMetricIconWrap4 = document.getElementById('metric-icon-wrap-4');
        const elMetricIcon4 = document.getElementById('metric-icon-4');
        const elMetricTitle4 = document.getElementById('metric-title-4');
        const elCapaianKinerja = document.getElementById('metric-capaian-kinerja');
        const elSubtext4 = document.getElementById('metric-subtext-4');
        const elProgressBar4 = document.getElementById('metric-progress-bar-4');
        const elExtraBadge4 = document.getElementById('metric-extra-badge-4');
        const elExtraNote4 = document.getElementById('metric-extra-note-4');

        function setCard4Theme(theme, iconClass, badgeHtml, noteText, progressWidth) {
            if (elKinerjaCard4) {
                elKinerjaCard4.className = `kinerja-pro-card kinerja-card-${theme} h-100`;
            }
            if (elMetricIconWrap4) {
                elMetricIconWrap4.className = `kinerja-card-icon-wrap icon-${theme}`;
            }
            if (elMetricIcon4) {
                elMetricIcon4.className = `bi ${iconClass}`;
            }
            if (elProgressBar4) {
                elProgressBar4.className = `kinerja-mini-progress-bar bar-${theme}`;
                elProgressBar4.style.width = `${progressWidth}%`;
            }
            if (elExtraBadge4) {
                elExtraBadge4.innerHTML = badgeHtml;
                if (theme === 'sapphire' || theme === 'cobalt') {
                    elExtraBadge4.className = 'badge bg-cobalt-subtle text-cobalt border border-cobalt-subtle rounded-pill px-2 py-0.5';
                } else if (theme === 'emerald' || theme === 'cyan' || theme === 'sky') {
                    elExtraBadge4.className = 'badge bg-sky-subtle text-sky border border-sky-subtle rounded-pill px-2 py-0.5';
                } else if (theme === 'ruby' || theme === 'steel') {
                    elExtraBadge4.className = 'badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-0.5';
                } else {
                    elExtraBadge4.className = 'badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2 py-0.5';
                }
            }
            if (elExtraNote4) {
                elExtraNote4.textContent = noteText || '';
            }
            if (elSubtext4) {
                elSubtext4.classList.add('d-none');
                elSubtext4.textContent = '';
            }
        }

        const s1Metrics = SASARAN_1_YEAR_DATA[activeYear] || SASARAN_1_YEAR_DATA['all'];

        const elMultiS2 = document.getElementById('sasaran-2-multi-container');
        const elStdView = document.getElementById('kinerja-standard-view');
        const elKpiCardsRow = document.getElementById('kinerja-kpi-cards-row');
        const elChartsRow = document.getElementById('kinerja-charts-row');

        if (isSasaran && activeSasaranTab === 'Sasaran 2') {
            if (elStdView) elStdView.classList.add('d-none');
            if (elMultiS2) {
                elMultiS2.classList.remove('d-none');
                renderSasaran2MultiSection(activeYear);
            }
            return;
        }

        if (elMultiS2) {
            elMultiS2.classList.add('d-none');
            if (state.charts && state.charts.sasaran2Charts && state.charts.sasaran2Charts.length > 0) {
                state.charts.sasaran2Charts.forEach(c => { if (c) c.destroy(); });
                state.charts.sasaran2Charts = [];
            }
        }
        if (elStdView) elStdView.classList.remove('d-none');

        if (isSasaran && activeSasaranTab === 'all') {
            if (elKpiCardsRow) elKpiCardsRow.classList.add('d-none');
            if (elChartsRow) elChartsRow.classList.add('d-none');
        } else {
            if (elKpiCardsRow) elKpiCardsRow.classList.remove('d-none');
            if (elChartsRow) elChartsRow.classList.remove('d-none');
        }

        if (isTujuan) {
            if (elMetricTitle1) elMetricTitle1.textContent = 'JUMLAH INDIKATOR';
            if (elMetricTitle2) elMetricTitle2.textContent = (activeYear === 'all') ? 'RATA-RATA TARGET INDIKATOR' : 'TARGET INDIKATOR';
            if (elMetricTitle3) elMetricTitle3.textContent = (activeYear === 'all') ? 'RATA-RATA REALISASI INDIKATOR' : 'REALISASI INDIKATOR';
            if (elMetricTitle4) elMetricTitle4.textContent = (activeYear === 'all') ? 'RATA-RATA CAPAIAN INDIKATOR' : 'CAPAIAN INDIKATOR';

            // Card 1
            let activeCount1 = '1';
            if (elJumlahIndikator) {
                if (activeYear === 'all') {
                    const allRows = (KINERJA_HIERARCHY_DATA.tujuan && KINERJA_HIERARCHY_DATA.tujuan.tableData) || [];
                    const rowsWithRealisasi = allRows.filter(r => r.realisasi && r.realisasi !== '-' && r.capaian && r.capaian !== '-');
                    activeCount1 = (rowsWithRealisasi.length || 8).toString();
                    elJumlahIndikator.textContent = activeCount1;
                } else {
                    activeCount1 = '1';
                    elJumlahIndikator.textContent = '1';
                }
            }
            if (elSubtext1) {
                elSubtext1.textContent = 'indikator';
            }
            if (elProgressBar1) elProgressBar1.style.width = '100%';
            if (elExtraBadge1) {
                elExtraBadge1.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${activeCount1} Indikator Aktif`;
            }
            if (elExtraNote1) {
                if (activeYear === 'all') {
                    elExtraNote1.textContent = 'Periode 2019 - 2025';
                } else {
                    const allTujuanRows = (KINERJA_HIERARCHY_DATA.tujuan && KINERJA_HIERARCHY_DATA.tujuan.tableData) || [];
                    const matchedTujuanRow = allTujuanRows.find(r => isKinerjaYearMatch(r.tahun, activeYear));
                    elExtraNote1.textContent = matchedTujuanRow ? matchedTujuanRow.name : (['2019', '2020', '2021', '2022', '2023', '2024'].includes(activeYear) ? 'Indeks Konektivitas' : 'Indeks Kinerja Jalan');
                }
                elExtraNote1.title = elExtraNote1.textContent;
            }

            // Card 2
            if (elRataTarget) {
                elRataTarget.textContent = yearMetrics.targetText;
                if (elSubtext2) {
                    elSubtext2.classList.remove('d-none');
                    elSubtext2.textContent = 'indeks';
                }
            }
            if (elProgressBar2) elProgressBar2.style.width = '100%';
            if (elExtraBadge2) {
                elExtraBadge2.innerHTML = '<i class="bi bi-file-earmark-text me-1"></i>Dokumen Renja';
            }
            if (elExtraNote2) {
                elExtraNote2.textContent = (activeYear === 'all' ? 'Tahun Anggaran 2019 - 2030' : `Tahun Anggaran ${activeYear}`);
            }

            // Card 3
            if (elRataRealisasi) {
                elRataRealisasi.textContent = yearMetrics.realisasiText;
                if (elSubtext3) {
                    elSubtext3.classList.remove('d-none');
                    elSubtext3.textContent = (yearMetrics.realisasiText !== '-') ? 'indeks' : 'Belum Ada Realisasi';
                }
            }
            if (elProgressBar3) {
                elProgressBar3.style.width = (yearMetrics.realisasiText !== '-') ? '100%' : '0%';
            }
            if (elExtraBadge3) {
                if (activeYear === 'all') {
                    elExtraBadge3.innerHTML = '<i class="bi bi-graph-up-arrow me-1"></i>+0,042 dari target (+5,69%)';
                } else if (yearMetrics.realisasiText !== '-') {
                    elExtraBadge3.innerHTML = `<i class="bi bi-check2-circle me-1"></i>${yearMetrics.statusDiff} dari target`;
                } else {
                    elExtraBadge3.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Belum Ada Realisasi';
                }
            }
            if (elExtraNote3) {
                elExtraNote3.textContent = (yearMetrics.realisasiText !== '-') ? 'Dokumen LKPJ' : 'Menunggu Pelaporan';
            }

            // Card 4
            if (elCapaianKinerja) {
                elCapaianKinerja.textContent = yearMetrics.capaianText;
            }
            const numericCapaian = (yearMetrics && typeof yearMetrics.capaianPct === 'number') ? yearMetrics.capaianPct : 0;
            const cInfo = getKinerjaCapaianStatusInfo(numericCapaian);
            const katLabel = (yearMetrics.capaianText !== '-') ? `Kategori ${cInfo.kategori}` : 'Belum Ada Realisasi';

            if (yearMetrics.capaianText !== '-') {
                if (numericCapaian > 100) {
                    setCard4Theme('sapphire', 'bi-trophy-fill', `<i class="bi bi-stars me-1"></i>Melampaui Target`, katLabel, 100);
                } else if (numericCapaian === 100) {
                    setCard4Theme('emerald', 'bi-check-circle-fill', '<i class="bi bi-check2-circle me-1"></i>Target Tercapai', katLabel, 100);
                } else {
                    setCard4Theme('ruby', 'bi-exclamation-triangle-fill', `<i class="bi bi-exclamation-circle-fill me-1"></i>Tidak Tercapai`, katLabel, Math.round(numericCapaian));
                }
            } else {
                setCard4Theme('slate', 'bi-hourglass-split', '<i class="bi bi-clock-history me-1"></i>Belum Ada Realisasi', katLabel, 0);
            }
        } else if (isSasaran) {
            // Level SASARAN (Kinerja_Sasaran Excel)
            if (activeSasaranTab === 'Sasaran 2') {
                const countNum = parseInt(sasaranActiveCount, 10) || 1;
                const isMulti = countNum > 1 || activeYear === 'all';
                if (elMetricTitle1) elMetricTitle1.textContent = 'JUMLAH INDIKATOR';
                if (elMetricTitle2) elMetricTitle2.textContent = isMulti ? 'RATA-RATA TARGET INDIKATOR' : 'TARGET INDIKATOR';
                if (elMetricTitle3) elMetricTitle3.textContent = isMulti ? 'RATA-RATA REALISASI INDIKATOR' : 'REALISASI INDIKATOR';
                if (elMetricTitle4) elMetricTitle4.textContent = isMulti ? 'RATA-RATA CAPAIAN INDIKATOR' : 'CAPAIAN INDIKATOR';
            } else {
                if (elMetricTitle1) elMetricTitle1.textContent = 'JUMLAH INDIKATOR';
                if (elMetricTitle2) elMetricTitle2.textContent = (activeYear === 'all') ? 'RATA-RATA TARGET INDIKATOR' : 'TARGET INDIKATOR';
                if (elMetricTitle3) elMetricTitle3.textContent = (activeYear === 'all') ? 'RATA-RATA REALISASI INDIKATOR' : 'REALISASI INDIKATOR';
                if (elMetricTitle4) elMetricTitle4.textContent = (activeYear === 'all') ? 'RATA-RATA CAPAIAN INDIKATOR' : 'CAPAIAN INDIKATOR';
            }

            const activeSasMetrics = (activeSasaranTab === 'Sasaran 1') 
                ? s1Metrics 
                : (activeSasaranTab === 'Sasaran 2' ? (SASARAN_2_YEAR_DATA[activeYear] || SASARAN_2_YEAR_DATA['all']) : sasaranYearMetrics);

            // Card 1
            let sasaranActiveCount = displaySasaranRows.length.toString();
            if (activeSasaranTab === 'Sasaran 1' && activeYear === 'all') {
                sasaranActiveCount = '7';
            }
            if (elJumlahIndikator) {
                elJumlahIndikator.textContent = sasaranActiveCount;
            }
            if (elSubtext1) {
                if (activeSasaranTab === 'all') {
                    elSubtext1.textContent = 'indikator sasaran';
                } else if (activeSasaranTab === 'Sasaran 1') {
                    elSubtext1.textContent = 'indikator';
                } else {
                    elSubtext1.textContent = 'indikator Sasaran 2';
                }
            }
            if (elProgressBar1) elProgressBar1.style.width = '100%';
            if (elExtraBadge1) {
                elExtraBadge1.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${sasaranActiveCount} Indikator Aktif`;
            }
            if (elExtraNote1) {
                if (activeSasaranTab === 'Sasaran 1') {
                    const s1Row = displaySasaranRows.find(r => r.jenisSasaran === 'Sasaran 1') || 
                                  allSasaranRows.find(r => r.jenisSasaran === 'Sasaran 1' && isKinerjaYearMatch(r.tahun, activeYear));
                    elExtraNote1.textContent = (s1Row && s1Row.name) ? s1Row.name : 'Nilai Evaluasi Implementasi SAKIP Perangkat Daerah';
                } else if (activeSasaranTab === 'Sasaran 2') {
                    elExtraNote1.textContent = 'Kemantapan & Pelayanan';
                } else {
                    elExtraNote1.textContent = (activeYear === 'all') ? 'Semua Sasaran' : `Tahun Anggaran ${activeYear}`;
                }
                elExtraNote1.title = elExtraNote1.textContent;
            }

            // Card 2
            if (elRataTarget) {
                const targetDisplay = (activeYear === 'all')
                    ? (activeSasMetrics.rataTargetText || activeSasMetrics.targetText)
                    : (activeSasMetrics.targetText || activeSasMetrics.rataTargetText);
                elRataTarget.textContent = targetDisplay || '-';
                if (elSubtext2) {
                    elSubtext2.classList.remove('d-none');
                    elSubtext2.textContent = (activeSasaranTab === 'Sasaran 1') ? 'indeks' : (activeSasaranTab === 'Sasaran 2' ? '%' : 'persen / nilai');
                }
            }
            if (elProgressBar2) elProgressBar2.style.width = '100%';
            if (elExtraBadge2) {
                elExtraBadge2.innerHTML = '<i class="bi bi-file-earmark-text me-1"></i>Dokumen Renja';
            }
            if (elExtraNote2) {
                if (activeSasaranTab === 'Sasaran 2' && activeYear === '2025') {
                    elExtraNote2.textContent = 'Kemantapan: 86,45% | Lebar: 48,33%';
                    elExtraNote2.title = 'Rincian Target: Kemantapan Jalan 86,45%, Lebar Jalan Standar 48,33%';
                } else if (activeSasaranTab === 'Sasaran 2' && (activeYear === '2025 RPD' || activeYear === '2025 (RPD)')) {
                    elExtraNote2.textContent = 'Kemantapan: 86,45% (RPD)';
                    elExtraNote2.title = 'Target Kemantapan Jalan RPD: 86,45%';
                } else {
                    elExtraNote2.textContent = (activeYear === 'all') ? 'Tahun Anggaran 2019 - 2030' : `Tahun Anggaran ${activeYear}`;
                    elExtraNote2.title = elExtraNote2.textContent;
                }
            }

            // Card 3
            if (elRataRealisasi) {
                const realisasiDisplay = (activeYear === 'all')
                    ? (activeSasMetrics.rataRealisasiText || activeSasMetrics.realisasiText)
                    : (activeSasMetrics.realisasiText || activeSasMetrics.rataRealisasiText);
                elRataRealisasi.textContent = realisasiDisplay || '-';
                if (elSubtext3) {
                    elSubtext3.classList.remove('d-none');
                    elSubtext3.textContent = (realisasiDisplay !== '-') 
                        ? ((activeSasaranTab === 'Sasaran 1') ? 'indeks' : (activeSasaranTab === 'Sasaran 2' ? '%' : 'persen / nilai'))
                        : 'Belum Ada Realisasi';
                }
            }
            if (elProgressBar3) {
                const hasRel = (activeSasMetrics.realisasiText !== '-' && activeSasMetrics.rataRealisasiText !== '-');
                elProgressBar3.style.width = hasRel ? '100%' : '0%';
            }
            if (elExtraBadge3) {
                if (activeSasMetrics.statusDiff && activeSasMetrics.statusDiff !== '-') {
                    elExtraBadge3.innerHTML = `<i class="bi bi-check2-circle me-1"></i>${activeSasMetrics.statusDiff} dari target`;
                } else {
                    elExtraBadge3.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Belum Ada Realisasi';
                }
            }
            if (elExtraNote3) {
                if (activeSasaranTab === 'Sasaran 2' && activeYear === '2025') {
                    elExtraNote3.textContent = 'Kemantapan: 86,51% | Lebar: 48,35%';
                    elExtraNote3.title = 'Realisasi Kemantapan Jalan: 86,51% (Tercapai)';
                } else if (activeSasaranTab === 'Sasaran 2' && (activeYear === '2025 RPD' || activeYear === '2025 (RPD)')) {
                    elExtraNote3.textContent = 'Kemantapan: 86,51% (RPD)';
                    elExtraNote3.title = 'Realisasi Kemantapan Jalan RPD: 86,51% (Tercapai)';
                } else {
                    const hasRel = (activeSasMetrics.realisasiText !== '-' && activeSasMetrics.rataRealisasiText !== '-');
                    elExtraNote3.textContent = hasRel ? 'Dokumen LKPJ' : 'Menunggu Pelaporan';
                    elExtraNote3.title = elExtraNote3.textContent;
                }
            }

            // Card 4
            if (elCapaianKinerja) {
                elCapaianKinerja.textContent = activeSasMetrics.capaianText || '-';
            }
            const sasNumericCapaian = (activeSasMetrics && typeof activeSasMetrics.capaianPct === 'number') ? activeSasMetrics.capaianPct : 0;
            const sasCInfo = getKinerjaCapaianStatusInfo(sasNumericCapaian);
            const sasKatLabel = (activeSasMetrics.capaianText !== '-') ? `Kategori ${activeSasMetrics.kategoriText || sasCInfo.kategori}` : 'Belum Ada Realisasi';

            if (activeSasMetrics.capaianText !== '-') {
                if (sasNumericCapaian > 100) {
                    setCard4Theme('sapphire', 'bi-trophy-fill', `<i class="bi bi-stars me-1"></i>Melampaui Target`, sasKatLabel, 100);
                } else if (sasNumericCapaian === 100) {
                    setCard4Theme('emerald', 'bi-check-circle-fill', '<i class="bi bi-check2-circle me-1"></i>Target Tercapai', sasKatLabel, 100);
                } else {
                    setCard4Theme('ruby', 'bi-exclamation-triangle-fill', `<i class="bi bi-exclamation-circle-fill me-1"></i>Tidak Tercapai`, sasKatLabel, Math.round(sasNumericCapaian));
                }
            } else {
                setCard4Theme('slate', 'bi-hourglass-split', '<i class="bi bi-clock-history me-1"></i>Belum Ada Realisasi', sasKatLabel, 0);
            }
        } else {
            // Untuk hierarki lain (Program, Kegiatan, Subkegiatan)
            if (elMetricTitle1) elMetricTitle1.textContent = 'JUMLAH INDIKATOR';
            if (elMetricTitle2) elMetricTitle2.textContent = (activeYear === 'all') ? 'RATA-RATA TARGET INDIKATOR' : 'TARGET INDIKATOR';
            if (elMetricTitle3) elMetricTitle3.textContent = (activeYear === 'all') ? 'RATA-RATA REALISASI INDIKATOR' : 'REALISASI INDIKATOR';
            if (elMetricTitle4) elMetricTitle4.textContent = (activeYear === 'all') ? 'RATA-RATA CAPAIAN INDIKATOR' : 'CAPAIAN INDIKATOR';

            if (elJumlahIndikator) elJumlahIndikator.textContent = currentData.metrics.jumlahIndikator;
            if (elSubtext1) elSubtext1.textContent = 'indikator';
            if (elProgressBar1) elProgressBar1.style.width = '100%';
            if (elExtraBadge1) elExtraBadge1.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${currentData.metrics.jumlahIndikator} Indikator Aktif`;
            if (elExtraNote1) elExtraNote1.textContent = `Level ${currentData.title}`;

            if (elRataTarget) elRataTarget.textContent = currentData.metrics.rataTargetText || currentData.metrics.rataTarget.toFixed(3).replace('.', ',');
            if (elSubtext2) {
                elSubtext2.classList.remove('d-none');
                elSubtext2.textContent = 'indeks';
            }
            if (elProgressBar2) elProgressBar2.style.width = '100%';
            if (elExtraBadge2) elExtraBadge2.innerHTML = '<i class="bi bi-file-earmark-text me-1"></i>Dokumen Renja';
            if (elExtraNote2) elExtraNote2.textContent = (activeYear === 'all') ? 'Tahun Anggaran 2019 - 2030' : `Tahun Anggaran ${activeYear}`;

            if (elRataRealisasi) elRataRealisasi.textContent = currentData.metrics.rataRealisasiText || currentData.metrics.rataRealisasi.toFixed(3).replace('.', ',');
            if (elSubtext3) {
                elSubtext3.classList.remove('d-none');
                elSubtext3.textContent = 'indeks';
            }
            if (elProgressBar3) elProgressBar3.style.width = '100%';
            if (elExtraBadge3) elExtraBadge3.innerHTML = `<i class="bi bi-graph-up-arrow me-1"></i>${currentData.metrics.statusDiff} dari target`;
            if (elExtraNote3) elExtraNote3.textContent = 'Dokumen LKPJ';

            if (elCapaianKinerja) elCapaianKinerja.textContent = currentData.metrics.capaianKinerjaText || (currentData.metrics.capaianKinerja.toFixed(2).replace('.', ',') + '%');
            if (elSubtext4) {
                elSubtext4.classList.add('d-none');
                elSubtext4.textContent = '';
            }
            const progCapaian = (currentData.metrics && typeof currentData.metrics.capaianKinerja === 'number') ? currentData.metrics.capaianKinerja : 0;
            const progInfo = getKinerjaCapaianStatusInfo(progCapaian);
            const progKatLabel = `Kategori ${currentData.metrics.kategoriText || progInfo.kategori}`;
            if (progCapaian > 100) {
                setCard4Theme('sapphire', 'bi-trophy-fill', '<i class="bi bi-stars me-1"></i>Melampaui Target', progKatLabel, 100);
            } else if (progCapaian === 100) {
                setCard4Theme('emerald', 'bi-check-circle-fill', '<i class="bi bi-check2-circle me-1"></i>Target Tercapai', progKatLabel, 100);
            } else if (progCapaian > 0) {
                setCard4Theme('ruby', 'bi-exclamation-triangle-fill', '<i class="bi bi-exclamation-circle-fill me-1"></i>Tidak Tercapai', progKatLabel, Math.round(progCapaian));
            } else {
                setCard4Theme('slate', 'bi-hourglass-split', '<i class="bi bi-clock-history me-1"></i>Belum Ada Realisasi', 'Belum Ada Realisasi', 0);
            }
        }

        // 3. Update Gauge Center and Status Boxes
        const elGaugePct = document.getElementById('gauge-center-pct');
        const elGaugeStatus = document.getElementById('gauge-center-status');
        const elStatusBox = document.getElementById('gauge-status-box');
        const elStatusIcon = document.getElementById('gauge-status-icon');
        const elStatusTitle = document.getElementById('gauge-status-title');
        const elStatusDiff = document.getElementById('gauge-status-diff');
        const elAlertText = document.getElementById('gauge-alert-text');
        const elChartPerbandinganTitle = document.getElementById('chart-perbandingan-title');
        const elChartCapaianTitle = document.getElementById('chart-capaian-title');
        const elTableCardTitle = document.getElementById('table-indikator-card-title');
        const elThIndikatorName = document.getElementById('th-indikator-name');
        const elThTargetYear = document.getElementById('th-target-year');
        const elThRealisasiYear = document.getElementById('th-realisasi-year');

        const activeSasMetrics = (activeSasaranTab === 'Sasaran 1') 
            ? s1Metrics 
            : (activeSasaranTab === 'Sasaran 2' ? (SASARAN_2_YEAR_DATA[activeYear] || SASARAN_2_YEAR_DATA['all']) : sasaranYearMetrics);

        const activeGaugePctText = isTujuan 
            ? yearMetrics.capaianText 
            : (isSasaran 
                ? activeSasMetrics.capaianText 
                : (currentData.metrics.capaianKinerjaText || (currentData.metrics.capaianKinerja.toFixed(2).replace('.', ',') + '%')));
        const numericCapaian = isTujuan 
            ? ((yearMetrics && typeof yearMetrics.capaianPct === 'number') ? yearMetrics.capaianPct : 0)
            : (isSasaran 
                ? ((activeSasMetrics && typeof activeSasMetrics.capaianPct === 'number') ? activeSasMetrics.capaianPct : 0) 
                : ((currentData && currentData.metrics && typeof currentData.metrics.capaianKinerja === 'number') ? currentData.metrics.capaianKinerja : 0));
        const hasRealisasi = isTujuan 
            ? (yearMetrics.capaianText !== '-') 
            : (isSasaran 
                ? (activeSasMetrics.capaianText !== '-') 
                : (currentData.metrics.capaianKinerjaText !== '-'));
        
        const capaianInfo = hasRealisasi ? getKinerjaCapaianStatusInfo(numericCapaian) : getKinerjaCapaianStatusInfo(0);
        const activeKategori = (isSasaran && activeSasMetrics.kategoriText) 
            ? activeSasMetrics.kategoriText 
            : capaianInfo.kategori;
        const activeStatusTitle = (isSasaran && activeSasMetrics.statusTitle) 
            ? activeSasMetrics.statusTitle 
            : capaianInfo.status;
        const activeStatusDiff = isTujuan 
            ? yearMetrics.statusDiff 
            : (isSasaran 
                ? activeSasMetrics.statusDiff 
                : currentData.metrics.statusDiff);

        if (elGaugePct) elGaugePct.textContent = activeGaugePctText;
        if (elGaugeStatus) {
            elGaugeStatus.textContent = activeKategori;
            elGaugeStatus.style.color = capaianInfo.textColor;
        }
        if (elStatusTitle) {
            elStatusTitle.textContent = activeStatusTitle;
            elStatusTitle.className = `fw-bold text-${capaianInfo.theme}`;
            elStatusTitle.style.fontSize = '0.825rem';
            elStatusTitle.style.lineHeight = '1.25rem';
        }
        if (elStatusBox) {
            elStatusBox.style.backgroundColor = capaianInfo.boxBg;
            elStatusBox.style.borderColor = capaianInfo.boxBorder;
            elStatusBox.style.width = '100%';
        }
        if (elStatusIcon) {
            elStatusIcon.className = `bi ${capaianInfo.icon} text-${capaianInfo.theme} fs-5`;
            elStatusIcon.style.lineHeight = '1';
        }
        if (elStatusDiff) {
            elStatusDiff.style.fontSize = '0.825rem';
            elStatusDiff.style.lineHeight = '1.25rem';
            elStatusDiff.style.marginTop = '6px';
            if (activeStatusDiff && activeStatusDiff !== '-') {
                elStatusDiff.innerHTML = `dengan selisih <strong class="text-dark fw-bold">${activeStatusDiff}</strong>`;
            } else {
                elStatusDiff.innerHTML = `<span class="text-muted">belum ada data realisasi</span>`;
            }
        }

        if (elAlertText) {
            if (isTujuan) {
                if (activeYear === 'all') {
                    elAlertText.innerHTML = `Capaian kinerja tujuan pada periode 2019 - 2025 berada pada kategori <strong>${activeKategori}</strong> (Rata-rata ${yearMetrics.capaianText}).`;
                } else if (yearMetrics.capaianText !== '-') {
                    elAlertText.innerHTML = `Capaian kinerja tujuan pada Tahun <strong>${activeYear}</strong> sebesar <strong>${yearMetrics.capaianText}</strong> berada pada kategori <strong>${activeKategori}</strong>.`;
                } else {
                    elAlertText.innerHTML = `Target kinerja tujuan Tahun <strong>${activeYear}</strong> adalah <strong>${yearMetrics.targetText}</strong> dan belum memiliki realisasi.`;
                }
            } else if (isSasaran) {
                const sasaranTextLabel = activeSasaranTab === 'all' ? 'sasaran' : activeSasaranTab;
                if (activeYear === 'all') {
                    if (activeSasaranTab === 'Sasaran 1') {
                        elAlertText.innerHTML = `Capaian kinerja Sasaran 1 pada periode 2019 - 2025 berada pada kategori <strong>${activeKategori}</strong> (Rata-rata Realisasi <strong>${s1Metrics.rataRealisasiText}</strong> dari Target <strong>${s1Metrics.rataTargetText}</strong> dengan Capaian <strong>${s1Metrics.capaianText}</strong>).`;
                    } else {
                        elAlertText.innerHTML = `Target kinerja ${sasaranTextLabel} pada sheet Kinerja_Sasaran memuat <strong>${displaySasaranRows.length} target indikator</strong> (2019 - 2030) dengan rata-rata capaian <strong>${activeSasMetrics.capaianText}</strong> (Kategori <strong>${activeKategori}</strong>).`;
                    }
                } else if (activeSasMetrics.capaianText !== '-') {
                    elAlertText.innerHTML = `Capaian kinerja ${sasaranTextLabel} pada Tahun <strong>${activeYear}</strong> sebesar <strong>${activeSasMetrics.capaianText}</strong> berada pada kategori <strong>${activeKategori}</strong> dengan ${displaySasaranRows.length} indikator aktif.`;
                } else {
                    elAlertText.innerHTML = `Target kinerja ${sasaranTextLabel} Tahun <strong>${activeYear}</strong> memuat <strong>${displaySasaranRows.length} target indikator</strong> dan belum memiliki data realisasi.`;
                }
            } else {
                elAlertText.innerHTML = `Capaian kinerja ${level} pada Tahun ${activeYear} berada pada kategori <strong>${activeKategori}</strong>.`;
            }
        }

        if (elChartPerbandinganTitle) {
            if (isTujuan) {
                elChartPerbandinganTitle.textContent = 'Perbandingan Target dan Realisasi Indikator Tujuan';
            } else if (isSasaran) {
                if (activeSasaranTab === 'Sasaran 1') {
                    elChartPerbandinganTitle.textContent = 'Perbandingan Target dan Realisasi Indikator';
                } else {
                    elChartPerbandinganTitle.textContent = activeSasaranTab === 'all' 
                        ? 'Perbandingan Target dan Realisasi Indikator Sasaran'
                        : `Perbandingan Target dan Realisasi Indikator ${activeSasaranTab}`;
                }
            } else {
                elChartPerbandinganTitle.textContent = `Perbandingan Target dan Realisasi Indikator ${currentData.title}`;
            }
        }
        if (elChartCapaianTitle) {
            if (isTujuan) {
                elChartCapaianTitle.textContent = (activeYear === 'all')
                    ? 'Rata-Rata Capaian Kinerja Tujuan'
                    : 'Capaian Kinerja Tujuan';
            } else if (isSasaran) {
                const sName = activeSasaranTab === 'all' ? 'Sasaran' : activeSasaranTab;
                elChartCapaianTitle.textContent = (activeYear === 'all')
                    ? `Rata-Rata Capaian Kinerja ${sName}`
                    : `Capaian Kinerja ${sName}`;
            } else {
                elChartCapaianTitle.textContent = (activeYear === 'all')
                    ? `Rata-Rata Capaian Kinerja ${currentData.title}`
                    : `Capaian Kinerja ${currentData.title}`;
            }
        }
        if (elTableCardTitle) {
            if (isTujuan) {
                elTableCardTitle.textContent = 'Daftar Indikator Tujuan';
            } else if (isSasaran) {
                elTableCardTitle.textContent = activeSasaranTab === 'all' ? 'Daftar Indikator Sasaran' : `Daftar Indikator ${activeSasaranTab}`;
            } else {
                elTableCardTitle.textContent = `Daftar Indikator ${currentData.title}`;
            }
        }
        if (elThIndikatorName) {
            if (isTujuan) {
                elThIndikatorName.textContent = 'Indikator Tujuan';
            } else if (isSasaran) {
                elThIndikatorName.textContent = activeSasaranTab === 'all' ? 'Indikator Sasaran' : `Indikator ${activeSasaranTab}`;
            } else {
                elThIndikatorName.textContent = `Indikator ${currentData.title}`;
            }
        }
        if (elThTargetYear) {
            elThTargetYear.textContent = activeYear === 'all' ? 'Target' : `Target ${activeYear}`;
        }
        if (elThRealisasiYear) {
            elThRealisasiYear.textContent = activeYear === 'all' ? 'Realisasi' : `Realisasi ${activeYear}`;
        }

        // 4. Render Charts (Bar Chart & Semi Donut Gauge)
        if (isSasaran && activeSasaranTab === 'all') {
            if (state.charts.targetPerspektif) {
                state.charts.targetPerspektif.destroy();
                state.charts.targetPerspektif = null;
            }
            if (state.charts.targetTahun) {
                state.charts.targetTahun.destroy();
                state.charts.targetTahun = null;
            }
            if (state.charts.targetTahunRpd) {
                state.charts.targetTahunRpd.destroy();
                state.charts.targetTahunRpd = null;
            }
            if (state.charts.targetTahunReg) {
                state.charts.targetTahunReg.destroy();
                state.charts.targetTahunReg = null;
            }
        } else {
            let chartDataToRender = currentData;
            if (isSasaran) {
                if (activeSasaranTab === 'Sasaran 1') {
                    chartDataToRender = {
                        chartData: {
                            labels: ['2019', '2020', '2021', '2022', '2023', '2024', ['2025', '(RPD)'], '2025', '2026', '2027', '2028', '2029', '2030'],
                            targets: [84.48, 86.28, 87.18, 88.10, 85.00, 85.10, 86.22, 86.22, 86.25, 86.28, 86.31, 86.34, 86.37],
                            realisasis: [84.48, 84.91, 84.95, 85.78, 85.83, 85.88, 89.18, 89.18, null, null, null, null, null],
                            capaians: [100.00, 98.41, 97.44, 97.37, 100.98, 100.92, 103.43, 103.43, null, null, null, null, null]
                        }
                    };
                }
            }
            renderKinerjaBarChart(chartDataToRender, activeYear, isSasaran);
            const gaugeMetricToRender = isTujuan 
                ? yearMetrics 
                : (isSasaran 
                    ? activeSasMetrics 
                    : currentData.metrics);
            renderKinerjaGaugeChart(gaugeMetricToRender, activeYear, isTujuan);
        }

        // 5. Render Table
        renderKinerjaTable(currentData, activeYear);
    }

    function renderKinerjaBarChart(data, activeYear = 'all', isSasaran = false) {
        const canvas = document.getElementById('chartPerbandinganTujuan');
        if (!canvas) return;

        if (state.charts.targetPerspektif) {
            state.charts.targetPerspektif.destroy();
        }

        const ctx = canvas.getContext('2d');
        const chartLabels = data.chartData.labels;
        const targets = data.chartData.targets;
        const realisasis = data.chartData.realisasis;
        const capaians = data.chartData.capaians || [102.59, 108.44, 100.43, 95.52, 99.88, 134.13, 105.20, 100.00, null, null, null, null, null];

        const isSasaran1 = isSasaran && (targetKinerjaState.activeSasaranTab === 'Sasaran 1');
        const isIndexScale = targets && targets.length > 0 && Math.max(...targets.filter(t => t !== null && !isNaN(t))) <= 2.5;

        // Visual bar height offset so bars have a visible height gap and labels sit right on top of their bars
        const visualTargets = [...targets];
        const visualRealisasis = [...realisasis];

        if (isIndexScale) {
            targets.forEach((tgt, idx) => {
                const rel = realisasis[idx];
                if (tgt !== null && rel !== null && rel !== undefined && !isNaN(rel)) {
                    const diff = rel - tgt;
                    // If target and realisasi are very close (height difference < 0.05)
                    if (Math.abs(diff) < 0.05) {
                        if (diff >= 0) {
                            visualRealisasis[idx] = tgt + 0.065;
                        } else {
                            visualTargets[idx] = rel + 0.065;
                        }
                    }
                }
            });
        } else if (isSasaran1 || (isSasaran && targets && Math.max(...targets.filter(t => t !== null && !isNaN(t))) > 50)) {
            targets.forEach((tgt, idx) => {
                const rel = realisasis[idx];
                if (tgt !== null && rel !== null && rel !== undefined && !isNaN(rel)) {
                    const diff = rel - tgt;
                    // If target and realisasi are very close (height difference < 2.2)
                    if (Math.abs(diff) < 2.2) {
                        if (diff > 0) {
                            visualRealisasis[idx] = tgt + 2.8;
                        } else if (diff < 0) {
                            visualTargets[idx] = rel + 2.8;
                        } else {
                            // Exactly equal (e.g. 2019 where Target 84.48 == Realisasi 84.48)
                            visualRealisasis[idx] = tgt + 2.8;
                        }
                    }
                }
            });
        }

        const isTimelineChart = (chartLabels && chartLabels.length > 0 && chartLabels.some(l => {
            const s = Array.isArray(l) ? l.join(' ') : String(l);
            return /20\d\d/.test(s);
        }));

        // Custom Plugin for rendering percentage or index values above bars and line points
        const dataLabelsPlugin = {
            id: 'barTopValueLabels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const rawVal = dataset.rawValues ? dataset.rawValues[index] : dataset.data[index];
                        if (rawVal !== undefined && rawVal !== null && !isNaN(rawVal)) {
                            const lbl = chartLabels[index] || '';
                            const lblStr = Array.isArray(lbl) ? lbl.join(' ') : String(lbl);
                            const isYearMatched = (!isTimelineChart) || (activeYear === 'all') || isChartLabelMatch(lbl, activeYear);

                            ctx.save();
                            ctx.textAlign = 'center';

                            if (dataset.type === 'line' || (dataset.label && dataset.label.includes('Capaian'))) {
                                ctx.font = isYearMatched ? '800 11px Poppins, sans-serif' : '600 9.5px Poppins, sans-serif';
                                ctx.fillStyle = isYearMatched ? '#1d4ed8' : '#93c5fd';
                                ctx.textBaseline = 'bottom';
                                const valText = rawVal.toFixed(2).replace('.', ',') + '%';
                                ctx.fillText(valText, element.x, element.y - (isYearMatched ? 9 : 7));
                            } else if (dataset.label === 'Target') {
                                ctx.font = isYearMatched ? '700 9.5px Poppins, sans-serif' : '500 8.5px Poppins, sans-serif';
                                ctx.fillStyle = isYearMatched ? '#b45309' : 'rgba(217, 119, 6, 0.55)';
                                ctx.textBaseline = 'bottom';
                                const isIndex = rawVal <= 2;
                                const isSakip = (targetKinerjaState.activeSasaranTab === 'Sasaran 1') || (isSasaran && lblStr.includes('SAKIP'));
                                const valText = isIndex ? rawVal.toFixed(3).replace('.', ',') : (isSakip ? rawVal.toFixed(2).replace('.', ',') : (rawVal.toFixed(2).replace('.', ',') + '%'));
                                ctx.fillText(valText, element.x, element.y - 4);
                            } else {
                                ctx.font = isYearMatched ? '700 9.5px Poppins, sans-serif' : '500 8.5px Poppins, sans-serif';
                                ctx.fillStyle = isYearMatched ? '#047857' : 'rgba(5, 150, 105, 0.55)';
                                ctx.textBaseline = 'bottom';
                                const isIndex = rawVal <= 2;
                                const isSakip = (targetKinerjaState.activeSasaranTab === 'Sasaran 1') || (isSasaran && lblStr.includes('SAKIP'));
                                const valText = isIndex ? rawVal.toFixed(3).replace('.', ',') : (isSakip ? rawVal.toFixed(2).replace('.', ',') : (rawVal.toFixed(2).replace('.', ',') + '%'));
                                ctx.fillText(valText, element.x, element.y - 4);
                            }
                            ctx.restore();
                        }
                    });
                });
            }
        };

        // Highlight bar colors if activeYear is filtered
        const targetBgColors = chartLabels.map(l => {
            return (!isTimelineChart || activeYear === 'all' || isChartLabelMatch(l, activeYear)) ? '#f59e0b' : 'rgba(245, 158, 11, 0.28)';
        });
        const targetBorderColors = chartLabels.map(l => {
            return (!isTimelineChart || activeYear === 'all' || isChartLabelMatch(l, activeYear)) ? '#d97706' : 'rgba(217, 119, 6, 0.25)';
        });

        const realisasiBgColors = chartLabels.map(l => {
            return (!isTimelineChart || activeYear === 'all' || isChartLabelMatch(l, activeYear)) ? '#10b981' : 'rgba(16, 185, 129, 0.28)';
        });
        const realisasiBorderColors = chartLabels.map(l => {
            return (!isTimelineChart || activeYear === 'all' || isChartLabelMatch(l, activeYear)) ? '#047857' : 'rgba(4, 120, 87, 0.25)';
        });

        const datasets = [
            {
                type: 'bar',
                label: 'Target',
                data: visualTargets,
                rawValues: targets,
                backgroundColor: targetBgColors,
                borderColor: targetBorderColors,
                hoverBackgroundColor: '#d97706',
                borderWidth: 1,
                borderRadius: 5,
                barPercentage: 0.86,
                categoryPercentage: 0.72,
                yAxisID: 'y',
                order: 2
            },
            {
                type: 'bar',
                label: 'Realisasi',
                data: visualRealisasis,
                rawValues: realisasis,
                backgroundColor: realisasiBgColors,
                borderColor: realisasiBorderColors,
                hoverBackgroundColor: '#059669',
                borderWidth: 1,
                borderRadius: 5,
                barPercentage: 0.86,
                categoryPercentage: 0.72,
                yAxisID: 'y',
                order: 2
            }
        ];

        // Add Line Chart for Capaian (%) only if non-null capaians exist
        if (capaians && capaians.some(c => c !== null && c !== undefined)) {
            const pointRadii = chartLabels.map(l => {
                return (activeYear !== 'all' && isChartLabelMatch(l, activeYear)) ? 7.5 : 4.5;
            });
            const pointBg = chartLabels.map(l => {
                return (activeYear !== 'all' && isChartLabelMatch(l, activeYear)) ? '#2563eb' : '#ffffff';
            });
            const pointBorder = chartLabels.map(l => {
                return (activeYear !== 'all' && isChartLabelMatch(l, activeYear)) ? '#ffffff' : '#2563eb';
            });
            const pointBorderW = chartLabels.map(l => {
                return (activeYear !== 'all' && isChartLabelMatch(l, activeYear)) ? 3.5 : 2.5;
            });

            datasets.unshift({
                type: 'line',
                label: 'Capaian (%)',
                data: capaians,
                borderColor: '#2563eb',
                borderWidth: 2.5,
                backgroundColor: '#ffffff',
                pointRadius: pointRadii,
                pointHoverRadius: 8,
                pointBackgroundColor: pointBg,
                pointBorderColor: pointBorder,
                pointBorderWidth: pointBorderW,
                pointHoverBorderWidth: 3,
                tension: 0.25,
                fill: false,
                yAxisID: 'y1',
                order: 1
            });
        }

        const hasLineChart = capaians && capaians.some(c => c !== null && c !== undefined);

        const yScaleConfig = {
            display: false,
            beginAtZero: true,
            grid: { display: false }
        };

        const y1ScaleConfig = {
            display: false,
            position: 'right',
            grid: { display: false }
        };

        if (isSasaran1 && hasLineChart) {
            yScaleConfig.min = 0;
            yScaleConfig.max = 145;
            y1ScaleConfig.min = -25;
            y1ScaleConfig.max = 125;
        } else if (isIndexScale && hasLineChart) {
            yScaleConfig.max = 1.85;
            y1ScaleConfig.min = -30;
            y1ScaleConfig.max = 160;
        } else if (hasLineChart) {
            yScaleConfig.suggestedMax = 120;
            y1ScaleConfig.min = 0;
            y1ScaleConfig.max = 130;
        } else if (isIndexScale) {
            yScaleConfig.suggestedMax = 1.15;
        } else {
            yScaleConfig.suggestedMax = 105;
        }

        state.charts.targetPerspektif = new Chart(ctx, {
            data: {
                labels: chartLabels,
                datasets: datasets
            },
            plugins: [dataLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 38,
                        bottom: 0,
                        left: 5,
                        right: 5
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const rawVal = context.dataset.rawValues ? context.dataset.rawValues[context.dataIndex] : context.raw;
                                if (rawVal === null || rawVal === undefined) return ` ${context.dataset.label}: -`;
                                if (context.dataset.type === 'line' || (context.dataset.label && context.dataset.label.includes('Capaian'))) {
                                    return ` ${context.dataset.label}: ${rawVal.toFixed(2).replace('.', ',')}%`;
                                }
                                const isIndex = rawVal <= 2;
                                const lblStr = Array.isArray(chartLabels[context.dataIndex]) ? chartLabels[context.dataIndex].join(' ') : String(chartLabels[context.dataIndex]);
                                const isSakip = (targetKinerjaState.activeSasaranTab === 'Sasaran 1') || (isSasaran && lblStr.includes('SAKIP'));
                                return ` ${context.dataset.label}: ${isIndex ? rawVal.toFixed(3).replace('.', ',') : (isSakip ? rawVal.toFixed(2).replace('.', ',') : (rawVal.toFixed(2).replace('.', ',') + '%'))}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Poppins', size: 10, weight: '600' },
                            color: function(context) {
                                const idx = (context && typeof context.index === 'number') ? context.index : (context && context.tick ? context.tick.value : 0);
                                const lbl = chartLabels[idx] || '';
                                const isYearMatched = (activeYear === 'all') || isChartLabelMatch(lbl, activeYear);
                                return (activeYear !== 'all' && isYearMatched) ? '#1e40af' : '#64748b';
                            },
                            maxRotation: 0,
                            autoSkip: false
                        }
                    },
                    y: yScaleConfig,
                    y1: y1ScaleConfig
                }
            }
        });
    }

    function renderKinerjaGaugeChart(data, activeYear = 'all', isTujuan = true) {
        if (state.charts.targetTahun) {
            state.charts.targetTahun.destroy();
            state.charts.targetTahun = null;
        }
        if (state.charts.targetTahunRpd) {
            state.charts.targetTahunRpd.destroy();
            state.charts.targetTahunRpd = null;
        }
        if (state.charts.targetTahunReg) {
            state.charts.targetTahunReg.destroy();
            state.charts.targetTahunReg = null;
        }

        const singleWrapper = document.getElementById('capaian-single-wrapper');
        const dualWrapper = document.getElementById('capaian-dual-2025-wrapper');

        if (dualWrapper) dualWrapper.classList.add('d-none');
        if (singleWrapper) singleWrapper.classList.remove('d-none');

        const canvas = document.getElementById('chartGaugeCapaian');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const capaian = (data && typeof data.capaianPct === 'number') 
            ? data.capaianPct 
            : ((data && data.metrics && typeof data.metrics.capaianKinerja === 'number') ? data.metrics.capaianKinerja : 0);

        const capaianInfo = getKinerjaCapaianStatusInfo(capaian);

        let arcValue = 0;
        let arcRemaining = 100;
        let arcColors = ['#cbd5e1', '#f1f5f9'];

        if (capaian > 0) {
            arcValue = Math.min(capaian, 100);
            arcRemaining = Math.max(0, 100 - arcValue);
            arcColors = [capaianInfo.gaugeColor, '#e2e8f0'];
        }

        state.charts.targetTahun = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [arcValue, arcRemaining],
                    backgroundColor: arcColors,
                    borderWidth: 0,
                    borderRadius: arcRemaining === 0 ? 10 : [10, 0]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                circumference: 180,
                rotation: -90,
                cutout: '76%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    // Table Renderer
    function renderKinerjaTable(data, activeYear = 'all') {
        const tbody = document.getElementById('kinerja-table-tbody');
        const paginationInfo = document.getElementById('kinerja-table-pagination-info');
        const query = targetKinerjaState.searchQuery.trim().toLowerCase();
        const level = targetKinerjaState.activeLevel || 'tujuan';
        const isTujuan = (level === 'tujuan');
        const isSasaran = (level === 'sasaran');

        if (!tbody) return;

        let rows = data.tableData || [];

        // Filter berdasarkan tahun jika level adalah tujuan atau sasaran dan activeYear !== 'all'
        let isFilteredByYear = false;
        if ((isTujuan || isSasaran) && activeYear && activeYear !== 'all') {
            const matchedRows = rows.filter(r => isKinerjaYearMatch(r.tahun, activeYear));
            if (matchedRows.length > 0) {
                rows = matchedRows;
                isFilteredByYear = true;
            }
        }

        // Filter berdasarkan activeSasaranTab jika level adalah sasaran
        if (isSasaran && targetKinerjaState.activeSasaranTab && targetKinerjaState.activeSasaranTab !== 'all') {
            rows = rows.filter(r => r.jenisSasaran === targetKinerjaState.activeSasaranTab);
        }

        if (isSasaran) {
            const S2_ORDER = { 'kemantapan': 1, 'lebar_teknis': 2, 'pelayanan': 3, 'konektivitas': 4 };
            rows = [...rows].sort((a, b) => {
                const yrA = (a.tahun || '').replace(/[^0-9]/g, '');
                const yrB = (b.tahun || '').replace(/[^0-9]/g, '');
                if (yrA !== yrB) return yrA.localeCompare(yrB);

                if (a.jenisSasaran !== b.jenisSasaran) {
                    return a.jenisSasaran === 'Sasaran 1' ? -1 : 1;
                }

                if (a.jenisSasaran === 'Sasaran 2') {
                    return (S2_ORDER[getS2GroupKey(a.name)] || 99) - (S2_ORDER[getS2GroupKey(b.name)] || 99);
                }

                return 0;
            });
        }

        if (query) {
            rows = rows.filter(r => 
                (r.name && r.name.toLowerCase().includes(query)) ||
                (r.satuan && r.satuan.toLowerCase().includes(query)) ||
                (r.status && r.status.toLowerCase().includes(query)) ||
                (r.tahun && r.tahun.toLowerCase().includes(query)) ||
                (r.jenisSasaran && r.jenisSasaran.toLowerCase().includes(query))
            );
        }

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada indikator yang sesuai kriteria.</td></tr>`;
            if (paginationInfo) paginationInfo.textContent = 'Menampilkan 0 data';
            return;
        }

        tbody.innerHTML = rows.map((r, idx) => {
            const statusLower = (r.status || '').toLowerCase();
            let statusBadgeClass = 'bg-warning-subtle text-warning border-warning-subtle';
            let statusIcon = 'bi-exclamation-circle';

            if (statusLower.includes('belum ada') || statusLower.includes('belum')) {
                statusBadgeClass = 'bg-warning-subtle text-warning border-warning-subtle';
                statusIcon = 'bi-hourglass-split';
            } else if (statusLower.includes('tidak tercapai')) {
                statusBadgeClass = 'bg-danger-subtle text-danger border-danger-subtle';
                statusIcon = 'bi-x-circle-fill';
            } else if (statusLower.includes('melebihi')) {
                statusBadgeClass = 'bg-primary-subtle text-primary border-primary-subtle';
                statusIcon = 'bi-check-all';
            } else if (statusLower.includes('tercapai')) {
                statusBadgeClass = 'bg-success-subtle text-success border-success-subtle';
                statusIcon = 'bi-check-circle-fill';
            } else if (statusLower.includes('renstra')) {
                statusBadgeClass = 'bg-secondary-subtle text-secondary border-secondary-subtle';
                statusIcon = 'bi-clock-history';
            }

            let yearBadge = `<span class="badge bg-light text-secondary border border-light-subtle px-2 py-1 fw-semibold" style="font-size: 0.72rem;">${r.tahun || activeYear}</span>`;
            if (r.tahun && r.tahun.includes('RPD')) {
                yearBadge = `
                    <div class="d-inline-flex align-items-center justify-content-center gap-1">
                        <span class="badge bg-light text-secondary border border-light-subtle px-2 py-1 fw-semibold" style="font-size: 0.72rem;">2025</span>
                        <span class="badge bg-light text-secondary border border-light-subtle fw-semibold px-1.5 py-0.5 rounded" style="font-size: 0.62rem; color: #64748b;" title="Rencana Pembangunan Daerah">RPD</span>
                    </div>
                `;
            }

            const rowNumber = isSasaran ? (idx + 1) : (isFilteredByYear ? (idx + 1) : (r.no || (idx + 1)));

            // Indikator Column: jika sasaran, tampilkan badge jenis sasaran (Sasaran 1 / Sasaran 2)
            let indicatorHtml = `<span class="fw-semibold text-dark">${r.name}</span>`;
            if (isSasaran && r.jenisSasaran) {
                const badgeColor = r.jenisSasaran === 'Sasaran 1' 
                    ? 'bg-primary-subtle text-primary border-primary-subtle'
                    : 'bg-emerald-subtle text-success border-success-subtle';

                let s2LabelBadge = '';
                if (r.jenisSasaran === 'Sasaran 2') {
                    const s2IndLabel = getSasaran2IndicatorLabel(r);
                    if (s2IndLabel) {
                        s2LabelBadge = `<span class="badge bg-light text-secondary border border-light-subtle px-2 py-0.5 rounded-pill fw-semibold ms-1" style="font-size: 0.68rem;">${s2IndLabel}</span>`;
                    }
                }

                indicatorHtml = `
                    <div class="d-flex flex-column gap-1">
                        <div class="d-flex align-items-center flex-wrap gap-1">
                            <span class="badge ${badgeColor} border px-2 py-0.5 rounded-pill fw-bold" style="font-size: 0.68rem;">${r.jenisSasaran}</span>
                            ${s2LabelBadge}
                        </div>
                        <span class="fw-semibold text-dark" style="font-size: 0.85rem; line-height: 1.35;">${r.name}</span>
                    </div>
                `;
            }

            return `
                <tr class="align-middle">
                    <td class="text-center fw-bold text-muted">${rowNumber}</td>
                    <td class="text-center">
                        ${yearBadge}
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            ${indicatorHtml}
                        </div>
                    </td>
                    <td class="text-center text-secondary">${r.satuan}</td>
                    <td class="text-center fw-semibold text-secondary">${r.target}</td>
                    <td class="text-center fw-semibold text-dark">${r.realisasi}</td>
                    <td class="text-center">
                        <span class="fw-bold text-dark px-2 py-0.5 rounded-pill bg-light border border-light-subtle d-inline-block">
                            ${r.capaian}
                        </span>
                    </td>
                    <td class="text-center">
                        <span class="badge ${statusBadgeClass} border rounded-pill px-2.5 py-1 fw-bold" style="font-size: 0.7rem;">
                            <i class="bi ${statusIcon} me-1"></i> ${r.status}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        if (paginationInfo) {
            if ((isTujuan || isSasaran) && isFilteredByYear) {
                paginationInfo.innerHTML = `Menampilkan 1 - ${rows.length} dari ${rows.length} data (Tahun ${activeYear}) <button type="button" class="btn btn-sm btn-link text-decoration-none p-0 ms-2 text-primary fw-semibold" onclick="document.getElementById('filter-tahun').value='all'; document.getElementById('filter-tahun').dispatchEvent(new Event('change'));"><i class="bi bi-arrows-fullscreen me-1"></i>Lihat Semua Tahun</button>`;
            } else if (isTujuan || isSasaran) {
                const sasLabel = (isSasaran && targetKinerjaState.activeSasaranTab !== 'all') ? `${targetKinerjaState.activeSasaranTab} - ` : '';
                paginationInfo.textContent = `Menampilkan 1 - ${rows.length} dari ${rows.length} data (${sasLabel}Semua Tahun 2019 - 2030)`;
            } else {
                paginationInfo.textContent = `Menampilkan 1 - ${rows.length} dari ${rows.length} data`;
            }
        }
    }

    const targetKinerjaTabBtn = document.getElementById('target-kinerja-tab');
    const kinerjaSearchInput = document.getElementById('kinerja-table-search');
    const globalSummaryCards = document.getElementById('global-summary-kpis');
    const kinerjaStepperCards = document.getElementById('kinerja-global-stepper');

    function showKinerjaHeaderCards() {
        if (globalSummaryCards) globalSummaryCards.classList.add('d-none');
        if (kinerjaStepperCards) kinerjaStepperCards.classList.add('d-none');
        if (typeof updateYearFilterOptions === 'function') {
            updateYearFilterOptions(true);
        }
    }

    function showStandardHeaderCards() {
        if (globalSummaryCards) globalSummaryCards.classList.remove('d-none');
        if (kinerjaStepperCards) kinerjaStepperCards.classList.add('d-none');
        if (typeof updateYearFilterOptions === 'function') {
            updateYearFilterOptions(false);
            applyFilters();
        }
    }

    function showJJHeaderCards() {
        if (globalSummaryCards) globalSummaryCards.classList.add('d-none');
        if (kinerjaStepperCards) kinerjaStepperCards.classList.add('d-none');
        if (typeof updateYearFilterOptions === 'function') {
            updateYearFilterOptions(false);
        }
    }

    // =========================================================================
    // SUB-SIDEBAR: ANGGARAN, KINERJA, & JALAN JEMBATAN TAB CONTROLLER
    // =========================================================================
    const anggaranMainBtn = document.getElementById('anggaran-main-btn');
    const submenuAnggaran = document.getElementById('submenu-anggaran');
    const anggaranPaguTab = document.getElementById('anggaran-pagu-tab');
    const anggaranRealisasiTab = document.getElementById('anggaran-realisasi-tab');

    const kinerjaMainBtn = document.getElementById('kinerja-main-btn');
    const submenuKinerja = document.getElementById('submenu-kinerja');
    const kinerjaTujuanTab = document.getElementById('kinerja-tujuan-tab');
    const kinerjaSasaranTab = document.getElementById('kinerja-sasaran-tab');
    const kinerjaProgramTab = document.getElementById('kinerja-program-tab');
    const kinerjaKegiatanTab = document.getElementById('kinerja-kegiatan-tab');
    const kinerjaSubkegiatanTab = document.getElementById('kinerja-subkegiatan-tab');

    const jjMainBtn = document.getElementById('jj-main-btn');
    const submenuJj = document.getElementById('submenu-jj');
    const jjDataTab = document.getElementById('jj-data-tab');
    const jjPaketTab = document.getElementById('jj-paket-tab');
    const jjPetaTab = document.getElementById('jj-peta-tab');

    function setAnggaranParentActive(isActive) {
        if (!anggaranMainBtn) return;
        if (isActive) {
            anggaranMainBtn.classList.add('active-parent');
        } else {
            anggaranMainBtn.classList.remove('active-parent');
        }
    }

    function setKinerjaParentActive(isActive) {
        if (!kinerjaMainBtn) return;
        if (isActive) {
            kinerjaMainBtn.classList.add('active-parent');
        } else {
            kinerjaMainBtn.classList.remove('active-parent');
        }
    }

    function setJJParentActive(isActive) {
        if (!jjMainBtn) return;
        if (isActive) {
            jjMainBtn.classList.add('active-parent');
        } else {
            jjMainBtn.classList.remove('active-parent');
        }
    }

    const allSidebarTabs = [
        { btnId: 'charts-tab', paneId: 'tab-charts', type: 'standard' },
        { btnId: 'anggaran-pagu-tab', paneId: 'tab-anggaran-pagu', type: 'anggaran' },
        { btnId: 'anggaran-realisasi-tab', paneId: 'tab-anggaran-realisasi', type: 'anggaran' },
        { btnId: 'mapping-tab', paneId: 'tab-mapping', type: 'standard' },
        { btnId: 'kinerja-tujuan-tab', paneId: 'tab-target-kinerja', type: 'kinerja', level: 'tujuan' },
        { btnId: 'kinerja-sasaran-tab', paneId: 'tab-target-kinerja', type: 'kinerja', level: 'sasaran' },
        { btnId: 'kinerja-program-tab', paneId: 'tab-target-kinerja', type: 'kinerja', level: 'program' },
        { btnId: 'kinerja-kegiatan-tab', paneId: 'tab-target-kinerja', type: 'kinerja', level: 'kegiatan' },
        { btnId: 'kinerja-subkegiatan-tab', paneId: 'tab-target-kinerja', type: 'kinerja', level: 'subkegiatan' },
        { btnId: 'jj-data-tab', paneId: 'tab-jj-data', type: 'jj' },
        { btnId: 'jj-paket-tab', paneId: 'tab-jj-paket', type: 'jj' },
        { btnId: 'jj-peta-tab', paneId: 'tab-jj-peta', type: 'jj' }
    ];

    function activateDashboardTab(activeBtnId) {
        const activeConfig = allSidebarTabs.find(t => t.btnId === activeBtnId);
        if (!activeConfig) return;

        // 1. Update button states across entire sidebar
        allSidebarTabs.forEach(t => {
            const btn = document.getElementById(t.btnId);
            if (btn) {
                if (t.btnId === activeBtnId) {
                    btn.classList.add('active');
                    btn.setAttribute('aria-selected', 'true');
                } else {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                }
            }
        });

        // 2. Synchronize main tab panes in #dashboard-tabContent
        const tabContent = document.getElementById('dashboard-tabContent');
        if (tabContent) {
            const panes = tabContent.querySelectorAll(':scope > .tab-pane');
            panes.forEach(pane => {
                if (pane.id === activeConfig.paneId) {
                    pane.classList.add('show', 'active');
                } else {
                    pane.classList.remove('show', 'active');
                }
            });
        }

        // 3. Handle parent menus, header cards, and specific module renderers
        if (activeConfig.type === 'jj') {
            setJJParentActive(true);
            setAnggaranParentActive(false);
            setKinerjaParentActive(false);

            if (submenuJj && !submenuJj.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getOrCreateInstance(submenuJj, { toggle: false });
                cObj.show();
            }
            if (submenuAnggaran && submenuAnggaran.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuAnggaran);
                if (cObj) cObj.hide();
            }
            if (submenuKinerja && submenuKinerja.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuKinerja);
                if (cObj) cObj.hide();
            }

            showJJHeaderCards();

            if (activeBtnId === 'jj-data-tab') {
                renderPaketTab();
                setTimeout(() => {
                    if (state.charts.paketUpt) state.charts.paketUpt.resize();
                    if (state.charts.paketKategori) state.charts.paketKategori.resize();
                }, 100);
            } else if (activeBtnId === 'jj-paket-tab') {
                renderPaketTab();
            } else if (activeBtnId === 'jj-peta-tab') {
                const baseData = state.filteredData.filter(r => 
                    r.program === 'Program Penyelenggaraan Jalan' || 
                    /jalan|jembatan/i.test(r.subkegiatan || '')
                );
                initOrUpdatePaketMap(baseData);
                setTimeout(() => {
                    if (paketMap) paketMap.invalidateSize();
                }, 200);
            }
        } else if (activeConfig.type === 'anggaran') {
            setAnggaranParentActive(true);
            setJJParentActive(false);
            setKinerjaParentActive(false);

            if (submenuAnggaran && !submenuAnggaran.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getOrCreateInstance(submenuAnggaran, { toggle: false });
                cObj.show();
            }
            if (submenuJj && submenuJj.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuJj);
                if (cObj) cObj.hide();
            }
            if (submenuKinerja && submenuKinerja.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuKinerja);
                if (cObj) cObj.hide();
            }

            showStandardHeaderCards();
        } else if (activeConfig.type === 'kinerja') {
            setAnggaranParentActive(false);
            setJJParentActive(false);
            setKinerjaParentActive(true);

            if (submenuKinerja && !submenuKinerja.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getOrCreateInstance(submenuKinerja, { toggle: false });
                cObj.show();
            }
            if (submenuAnggaran && submenuAnggaran.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuAnggaran);
                if (cObj) cObj.hide();
            }
            if (submenuJj && submenuJj.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuJj);
                if (cObj) cObj.hide();
            }

            showKinerjaHeaderCards();
            switchKinerjaLevel(activeConfig.level || 'tujuan');
        } else {
            // standard (Ringkasan, Program)
            setAnggaranParentActive(false);
            setJJParentActive(false);
            setKinerjaParentActive(false);

            if (submenuAnggaran && submenuAnggaran.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuAnggaran);
                if (cObj) cObj.hide();
            }
            if (submenuJj && submenuJj.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuJj);
                if (cObj) cObj.hide();
            }
            if (submenuKinerja && submenuKinerja.classList.contains('show')) {
                const cObj = bootstrap.Collapse.getInstance(submenuKinerja);
                if (cObj) cObj.hide();
            }

            showStandardHeaderCards();
        }
    }

    // Attach click and tab shown listeners to all tab buttons
    allSidebarTabs.forEach(t => {
        const el = document.getElementById(t.btnId);
        if (el) {
            el.addEventListener('click', function () {
                activateDashboardTab(t.btnId);
            });
            el.addEventListener('shown.bs.tab', function () {
                activateDashboardTab(t.btnId);
            });
        }
    });

    if (anggaranMainBtn) {
        anggaranMainBtn.addEventListener('click', function () {
            const isAnySubActive = (anggaranPaguTab && anggaranPaguTab.classList.contains('active')) ||
                                   (anggaranRealisasiTab && anggaranRealisasiTab.classList.contains('active'));
            if (!isAnySubActive && anggaranPaguTab) {
                activateDashboardTab('anggaran-pagu-tab');
            }
        });
    }

    if (kinerjaMainBtn) {
        kinerjaMainBtn.addEventListener('click', function () {
            const isAnySubActive = (kinerjaTujuanTab && kinerjaTujuanTab.classList.contains('active')) ||
                                   (kinerjaSasaranTab && kinerjaSasaranTab.classList.contains('active')) ||
                                   (kinerjaProgramTab && kinerjaProgramTab.classList.contains('active')) ||
                                   (kinerjaKegiatanTab && kinerjaKegiatanTab.classList.contains('active')) ||
                                   (kinerjaSubkegiatanTab && kinerjaSubkegiatanTab.classList.contains('active'));
            if (!isAnySubActive && kinerjaTujuanTab) {
                activateDashboardTab('kinerja-tujuan-tab');
            }
        });
    }

    if (jjMainBtn) {
        jjMainBtn.addEventListener('click', function () {
            const isAnySubActive = (jjDataTab && jjDataTab.classList.contains('active')) ||
                                   (jjPaketTab && jjPaketTab.classList.contains('active')) ||
                                   (jjPetaTab && jjPetaTab.classList.contains('active'));
            if (!isAnySubActive && jjDataTab) {
                activateDashboardTab('jj-data-tab');
            }
        });
    }

    if (kinerjaSearchInput) {
        kinerjaSearchInput.addEventListener('input', function() {
            targetKinerjaState.searchQuery = this.value;
            const level = targetKinerjaState.activeLevel || 'tujuan';
            const activeYear = (state && state.activeFilters && state.activeFilters.tahun) ? state.activeFilters.tahun : 'all';
            const currentData = level === 'tujuan' ? KINERJA_HIERARCHY_DATA.tujuan : (level === 'sasaran' ? KINERJA_HIERARCHY_DATA.sasaran : ((KINERJA_HIERARCHY_DATA.years[activeYear] || KINERJA_HIERARCHY_DATA.years['2025'])[level] || KINERJA_HIERARCHY_DATA.tujuan));
            renderKinerjaTable(currentData, activeYear);
        });
    }

    // =========================================================================
    // MODUL: PAKET PEKERJAAN JALAN DAN JEMBATAN
    // =========================================================================
    const paketState = {
        categoryFilter: 'all', // 'all', 'jalan', 'jembatan', 'teknis'
        searchQuery: '',
        currentPage: 1,
        pageSize: 15,
        listenersInitialized: false
    };

    function getPaketCategory(subkeg) {
        const s = (subkeg || '').toLowerCase();
        if (/survey|perencanaan|kebijakan|strategi|teknis|leger|pemantauan|pengawasan/i.test(s)) return 'teknis';
        if (/jembatan/i.test(s)) return 'jembatan';
        return 'jalan';
    }

    function getPaketCategoryBadge(category) {
        if (category === 'jalan') {
            return '<span class="badge badge-paket-jalan px-2 py-1 rounded-pill fw-semibold"><i class="bi bi-signpost-2-fill me-1"></i>Jalan</span>';
        } else if (category === 'jembatan') {
            return '<span class="badge badge-paket-jembatan px-2 py-1 rounded-pill fw-semibold"><i class="bi bi-water me-1"></i>Jembatan</span>';
        } else {
            return '<span class="badge badge-paket-teknis px-2 py-1 rounded-pill fw-semibold"><i class="bi bi-tools me-1"></i>Teknis</span>';
        }
    }

    function renderPaketTab() {
        const baseData = state.filteredData.filter(r => 
            r.program === 'Program Penyelenggaraan Jalan' || 
            /jalan|jembatan/i.test(r.subkegiatan || '')
        );

        // Update Total Badges
        const elDataBadge = document.getElementById('jj-data-total-badge');
        if (elDataBadge) elDataBadge.textContent = `${baseData.length.toLocaleString('id-ID')} Paket`;

        const elBadge = document.getElementById('paket-total-badge');
        if (elBadge) elBadge.textContent = `${baseData.length.toLocaleString('id-ID')} Paket`;

        // 1. Render Charts in Data Tab
        renderPaketCharts(baseData);

        // 2. Render Table in Paket Tab
        renderPaketTable(baseData);

        // 3. Render or Sync Map in Peta Tab
        initOrUpdatePaketMap(baseData);

        // 4. Initialize event listeners once
        initPaketEventListeners();
    }

    function renderPaketCharts(baseData) {
        // --- Chart 1: UPT Bar Chart ---
        const uptCanvas = document.getElementById('chart-paket-upt');
        if (uptCanvas) {
            const ctxUpt = uptCanvas.getContext('2d');
            if (state.charts.paketUpt) {
                state.charts.paketUpt.destroy();
            }

            const uptGroups = {};
            baseData.forEach(r => {
                let upt = r.bidangUpt || 'Lainnya';
                if (upt.includes('UPT PENGELOLAAN JALAN DAN JEMBATAN')) {
                    upt = upt.replace('UPT PENGELOLAAN JALAN DAN JEMBATAN', 'UPT PJJ');
                }
                if (!uptGroups[upt]) {
                    uptGroups[upt] = { pagu: 0, realisasi: 0 };
                }
                uptGroups[upt].pagu += (r.anggaran || 0);
                uptGroups[upt].realisasi += (r.realisasi || 0);
            });

            const sortedUpt = Object.entries(uptGroups).sort((a, b) => b[1].pagu - a[1].pagu).slice(0, 10);
            const labels = sortedUpt.map(item => item[0].replace('UPT PJJ ', '').replace('Bidang ', ''));
            const paguValues = sortedUpt.map(item => item[1].pagu);
            const realisasiValues = sortedUpt.map(item => item[1].realisasi);

            state.charts.paketUpt = new Chart(ctxUpt, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Pagu Anggaran',
                            data: paguValues,
                            backgroundColor: 'rgba(37, 99, 235, 0.85)',
                            borderRadius: 4,
                            barPercentage: 0.7
                        },
                        {
                            label: 'Realisasi',
                            data: realisasiValues,
                            backgroundColor: 'rgba(16, 185, 129, 0.85)',
                            borderRadius: 4,
                            barPercentage: 0.7
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                boxWidth: 12,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: { family: 'Poppins', size: 11, weight: '500' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${formatRupiah(context.raw)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                font: { family: 'Poppins', size: 10 }
                            },
                            grid: { display: false }
                        },
                        y: {
                            ticks: {
                                callback: function(val) { return formatShortRupiah(val); },
                                font: { family: 'Poppins', size: 10 }
                            },
                            grid: { color: 'rgba(226, 232, 240, 0.6)' }
                        }
                    }
                }
            });
        }

        // --- Chart 2: Komposisi Pekerjaan Doughnut Chart ---
        const katCanvas = document.getElementById('chart-paket-kategori');
        if (katCanvas) {
            const ctxKat = katCanvas.getContext('2d');
            if (state.charts.paketKategori) {
                state.charts.paketKategori.destroy();
            }

            const katGroups = {
                'Pembangunan Jalan': 0,
                'Pemeliharaan/Preservasi Jalan': 0,
                'Rekonstruksi/Pelebaran': 0,
                'Jembatan (Bangun/Rehab)': 0,
                'Perencanaan & Teknis': 0
            };

            baseData.forEach(r => {
                const s = (r.subkegiatan || '').toLowerCase();
                const val = r.anggaran || 0;
                if (/pembangunan jalan/i.test(s)) {
                    katGroups['Pembangunan Jalan'] += val;
                } else if (/pemeliharaan.*jalan/i.test(s)) {
                    katGroups['Pemeliharaan/Preservasi Jalan'] += val;
                } else if (/rekonstruksi|pelebaran/i.test(s)) {
                    katGroups['Rekonstruksi/Pelebaran'] += val;
                } else if (/jembatan/i.test(s)) {
                    katGroups['Jembatan (Bangun/Rehab)'] += val;
                } else {
                    katGroups['Perencanaan & Teknis'] += val;
                }
            });

            const katLabels = Object.keys(katGroups);
            const katValues = Object.values(katGroups);
            const katColors = [
                '#2563eb', // Blue
                '#0ea5e9', // Sky blue
                '#8b5cf6', // Violet
                '#10b981', // Emerald
                '#f59e0b'  // Amber
            ];

            state.charts.paketKategori = new Chart(ctxKat, {
                type: 'doughnut',
                data: {
                    labels: katLabels,
                    datasets: [{
                        data: katValues,
                        backgroundColor: katColors,
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '68%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 10,
                                usePointStyle: true,
                                font: { family: 'Poppins', size: 10.5 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = katValues.reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                                    return `${context.label}: ${formatRupiah(context.raw)} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    function renderPaketTable(baseData) {
        const tbody = document.getElementById('paket-table-tbody');
        if (!tbody) return;

        let filtered = baseData;
        if (paketState.categoryFilter !== 'all') {
            filtered = filtered.filter(r => getPaketCategory(r.subkegiatan) === paketState.categoryFilter);
        }

        if (paketState.searchQuery.trim() !== '') {
            const q = paketState.searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                (r.subkegiatan && r.subkegiatan.toLowerCase().includes(q)) ||
                (r.bidangUpt && r.bidangUpt.toLowerCase().includes(q)) ||
                (r.indikator && r.indikator.toLowerCase().includes(q))
            );
        }

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / paketState.pageSize) || 1;
        if (paketState.currentPage > totalPages) paketState.currentPage = totalPages;
        if (paketState.currentPage < 1) paketState.currentPage = 1;

        const startIndex = (paketState.currentPage - 1) * paketState.pageSize;
        const endIndex = Math.min(startIndex + paketState.pageSize, totalItems);
        const pageData = filtered.slice(startIndex, endIndex);

        const subtitleEl = document.getElementById('paket-table-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = `Menampilkan ${totalItems.toLocaleString('id-ID')} paket pekerjaan sesuai filter`;
        }

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                        Tidak ada paket pekerjaan yang sesuai dengan kriteria penyaringan.
                    </td>
                </tr>
            `;
            renderPaketPagination(0, 1);
            return;
        }

        let html = '';
        pageData.forEach((row, idx) => {
            const no = startIndex + idx + 1;
            const category = getPaketCategory(row.subkegiatan);
            const badgeHtml = getPaketCategoryBadge(category);
            const targetText = row.nilaiIndikator > 0 
                ? `${(row.nilaiIndikator % 1 === 0 ? row.nilaiIndikator : row.nilaiIndikator.toFixed(3)).toLocaleString('id-ID')} ${row.satuan || ''}` 
                : '-';
            
            const paguText = formatRupiah(row.anggaran || 0);
            const realisasiText = formatRupiah(row.realisasi || 0);
            
            let pct = 0;
            if (row.anggaran > 0 && row.realisasi > 0) {
                pct = ((row.realisasi / row.anggaran) * 100).toFixed(2);
            }
            let pctBadgeClass = 'badge bg-secondary-subtle text-secondary';
            if (pct >= 80) pctBadgeClass = 'badge bg-success-subtle text-success border border-success-subtle';
            else if (pct > 0) pctBadgeClass = 'badge bg-warning-subtle text-warning border border-warning-subtle';

            html += `
                <tr>
                    <td class="text-center fw-semibold text-secondary">${no}</td>
                    <td>${badgeHtml}</td>
                    <td>
                        <div class="fw-bold text-dark mb-0.5" style="max-width: 320px; word-break: break-word;">${row.subkegiatan}</div>
                        <div class="text-muted" style="font-size: 0.68rem;">${row.indikator || ''}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border fw-normal" style="font-size: 0.72rem;">${row.bidangUpt}</span>
                    </td>
                    <td class="text-end fw-semibold text-dark">${targetText}</td>
                    <td class="text-end fw-bold text-primary">${paguText}</td>
                    <td class="text-end fw-bold text-success" style="color: #059669 !important;">${realisasiText}</td>
                    <td class="text-center">
                        <span class="${pctBadgeClass} px-2 py-1 rounded-pill fw-bold" style="font-size: 0.72rem;">${pct}%</span>
                    </td>
                    <td class="text-center">
                        <button class="btn btn-xs btn-outline-primary rounded-pill py-1 px-2.5 shadow-2xs" onclick="showRowDetails(${row.no})" title="Lihat Rincian Paket">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        renderPaketPagination(totalItems, totalPages);
    }

    function renderPaketPagination(totalItems, totalPages) {
        const paginationInfo = document.getElementById('paket-pagination-info');
        const container = document.getElementById('paket-pagination-container');
        if (paginationInfo) {
            const start = totalItems === 0 ? 0 : (paketState.currentPage - 1) * paketState.pageSize + 1;
            const end = Math.min(paketState.currentPage * paketState.pageSize, totalItems);
            paginationInfo.textContent = `Menampilkan ${start} - ${end} dari ${totalItems.toLocaleString('id-ID')} data`;
        }
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        html += `
            <li class="page-item ${paketState.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePaketPage(${paketState.currentPage - 1}); return false;" aria-label="Sebelumnya">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;

        let startPage = Math.max(1, paketState.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let p = startPage; p <= endPage; p++) {
            html += `
                <li class="page-item ${p === paketState.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePaketPage(${p}); return false;">${p}</a>
                </li>
            `;
        }

        html += `
            <li class="page-item ${paketState.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePaketPage(${paketState.currentPage + 1}); return false;" aria-label="Selanjutnya">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;

        container.innerHTML = html;
    }

    window.changePaketPage = function(page) {
        paketState.currentPage = page;
        const baseData = state.filteredData.filter(r => 
            r.program === 'Program Penyelenggaraan Jalan' || 
            /jalan|jembatan/i.test(r.subkegiatan || '')
        );
        renderPaketTable(baseData);
    };

    function initPaketEventListeners() {
        if (paketState.listenersInitialized) return;
        paketState.listenersInitialized = true;

        const tabBtns = document.querySelectorAll('#paket-category-tabs .paket-filter-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                tabBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                paketState.categoryFilter = this.getAttribute('data-paket-filter') || 'all';
                paketState.currentPage = 1;
                const baseData = state.filteredData.filter(r => 
                    r.program === 'Program Penyelenggaraan Jalan' || 
                    /jalan|jembatan/i.test(r.subkegiatan || '')
                );
                renderPaketTable(baseData);
            });
        });

        const searchInput = document.getElementById('paket-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                paketState.searchQuery = this.value;
                paketState.currentPage = 1;
                const baseData = state.filteredData.filter(r => 
                    r.program === 'Program Penyelenggaraan Jalan' || 
                    /jalan|jembatan/i.test(r.subkegiatan || '')
                );
                renderPaketTable(baseData);
            });
        }

        // Subtab Peta event listener
        const petaTabBtn = document.getElementById('subtab-paket-peta-btn');
        if (petaTabBtn) {
            petaTabBtn.addEventListener('shown.bs.tab', function () {
                const baseData = state.filteredData.filter(r => 
                    r.program === 'Program Penyelenggaraan Jalan' || 
                    /jalan|jembatan/i.test(r.subkegiatan || '')
                );
                initOrUpdatePaketMap(baseData);
                if (paketMap) {
                    setTimeout(() => {
                        paketMap.invalidateSize();
                    }, 200);
                }
            });
        }

        // Dropdown UPT filter on Map
        const uptSelect = document.getElementById('peta-upt-select');
        if (uptSelect) {
            uptSelect.addEventListener('change', function() {
                if (this.value === 'all') {
                    if (paketMap) {
                        paketMap.flyTo([-7.536, 112.238], 8, { duration: 1 });
                        paketMap.closePopup();
                    }
                    document.querySelectorAll('.upt-map-card').forEach(c => c.classList.remove('active'));
                } else {
                    focusUptOnMap(this.value);
                }
            });
        }

        // Reset Map View Button
        const btnResetMap = document.getElementById('btn-reset-map-view');
        if (btnResetMap) {
            btnResetMap.addEventListener('click', function() {
                if (paketMap) {
                    paketMap.flyTo([-7.536, 112.238], 8, { duration: 1 });
                    paketMap.closePopup();
                }
                if (uptSelect) uptSelect.value = 'all';
                document.querySelectorAll('.upt-map-card').forEach(c => c.classList.remove('active'));
            });
        }
    }

    // =========================================================================
    // SUB-MODUL: PETA GIS SEBARAN PAKET JALAN & JEMBATAN
    // =========================================================================
    let paketMap = null;
    let paketMapMarkers = [];

    const UPT_LOCATIONS = [
        { id: 'surabaya', name: 'UPT PJJ Surabaya', aliases: ['SURABAYA'], wilayah: 'Surabaya, Sidoarjo, Gresik', lat: -7.2892, lng: 112.7344 },
        { id: 'mojokerto', name: 'UPT PJJ Mojokerto', aliases: ['MOJOKERTO'], wilayah: 'Mojokerto, Jombang', lat: -7.4726, lng: 112.4381 },
        { id: 'bojonegoro', name: 'UPT PJJ Bojonegoro', aliases: ['BOJONEGORO'], wilayah: 'Bojonegoro, Tuban, Lamongan', lat: -7.1509, lng: 111.8818 },
        { id: 'madiun', name: 'UPT PJJ Madiun', aliases: ['MADIUN'], wilayah: 'Madiun, Ngawi, Magetan', lat: -7.6298, lng: 111.5239 },
        { id: 'pacitan', name: 'UPT PJJ Pacitan', aliases: ['PACITAN'], wilayah: 'Pacitan', lat: -8.2065, lng: 111.0963 },
        { id: 'kediri', name: 'UPT PJJ Kediri', aliases: ['KEDIRI'], wilayah: 'Kediri, Nganjuk, Blitar, Tulungagung, Trenggalek', lat: -7.8166, lng: 112.0118 },
        { id: 'malang', name: 'UPT PJJ Malang', aliases: ['MALANG'], wilayah: 'Malang, Kota Batu, Pasuruan', lat: -7.9839, lng: 112.6214 },
        { id: 'probolinggo', name: 'UPT PJJ Probolinggo', aliases: ['PROBOLINGGO'], wilayah: 'Probolinggo, Lumajang', lat: -7.7543, lng: 113.2159 },
        { id: 'jember', name: 'UPT PJJ Jember', aliases: ['JEMBER'], wilayah: 'Jember, Bondowoso, Situbondo', lat: -8.1724, lng: 113.7007 },
        { id: 'banyuwangi', name: 'UPT PJJ Banyuwangi', aliases: ['BANYUWANGI'], wilayah: 'Banyuwangi', lat: -8.2192, lng: 114.3692 },
        { id: 'pamekasan', name: 'UPT PJJ Pamekasan', aliases: ['PAMEKASAN'], wilayah: 'Madura (Bangkalan, Sampang, Pamekasan, Sumenep)', lat: -7.1565, lng: 113.4746 },
        { id: 'pusat', name: 'Dinas PU Bina Marga (Pusat)', aliases: ['PEMBANGUNAN', 'PEMELIHARAAN', 'BINA TEKNIK', 'PENGATURAN', 'LABORATORIUM'], wilayah: 'Kantor Pusat Provinsi & Bidang Teknis', lat: -7.3323, lng: 112.7297, isPusat: true }
    ];

    function getActivePaketBaseData() {
        return state.filteredData.filter(r => 
            r.program === 'Program Penyelenggaraan Jalan' || 
            /jalan|jembatan/i.test(r.subkegiatan || '')
        );
    }

    function initOrUpdatePaketMap(baseData) {
        const mapContainer = document.getElementById('paket-map-container');
        if (!mapContainer || typeof L === 'undefined') return;

        // Initialize Leaflet map instance once
        if (!paketMap) {
            paketMap = L.map('paket-map-container', {
                center: [-7.536, 112.238],
                zoom: 8,
                minZoom: 7,
                maxZoom: 18,
                scrollWheelZoom: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(paketMap);
        }

        // Clear existing markers
        paketMapMarkers.forEach(m => paketMap.removeLayer(m));
        paketMapMarkers = [];

        // Populate UPT dropdown if empty
        const uptSelect = document.getElementById('peta-upt-select');
        if (uptSelect && uptSelect.options.length <= 1) {
            UPT_LOCATIONS.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc.id;
                opt.textContent = loc.name;
                uptSelect.appendChild(opt);
            });
        }

        // Aggregate statistics per UPT
        const cardListContainer = document.getElementById('peta-upt-card-list');
        let cardListHtml = '';

        UPT_LOCATIONS.forEach(loc => {
            const matched = baseData.filter(r => {
                const bu = (r.bidangUpt || '').toUpperCase();
                return loc.aliases.some(a => bu.includes(a));
            });

            const totalPagu = matched.reduce((a, b) => a + (b.anggaran || 0), 0);
            const totalRealisasi = matched.reduce((a, b) => a + (b.realisasi || 0), 0);
            const jalanCount = matched.filter(r => /jalan/i.test(r.subkegiatan) && !/jembatan/i.test(r.subkegiatan)).length;
            const jembatanCount = matched.filter(r => /jembatan/i.test(r.subkegiatan)).length;
            const serapan = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1).replace('.', ',') : '0';

            const pinColor = loc.isPusat ? '#d97706' : '#2563eb';
            const pinType = loc.isPusat ? 'pusat' : 'upt';
            const pinIcon = loc.isPusat ? 'bi-building-fill' : 'bi-geo-alt-fill';

            // Custom Leaflet DivIcon: Modern glowing pin with pulse radar & micro budget pill
            const customIcon = L.divIcon({
                className: 'custom-map-div-icon',
                html: `
                    <div class="custom-map-marker-container" title="${loc.name}">
                        <div class="marker-pill-budget ${pinType}">
                            ${formatShortRupiah(totalPagu)}
                        </div>
                        <div class="marker-pulse-radar ${pinType}"></div>
                        <div class="marker-pin-body ${pinType}">
                            <i class="bi ${pinIcon} marker-pin-icon"></i>
                        </div>
                    </div>
                `,
                iconSize: [60, 64],
                iconAnchor: [30, 60],
                popupAnchor: [0, -56],
                tooltipAnchor: [0, -60]
            });

            const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(paketMap);
            
            // Hover Tooltip: Tampilkan Berapa Anggarannya secara menonjol
            const tooltipContent = `
                <div class="upt-tooltip-inner">
                    <div class="upt-tooltip-header">
                        <div class="upt-tooltip-title">
                            <i class="bi ${pinIcon}" style="color: ${loc.isPusat ? '#fbbf24' : '#38bdf8'}; font-size: 1rem;"></i>
                            <span>${loc.name}</span>
                        </div>
                        <div class="upt-tooltip-wilayah">${loc.wilayah}</div>
                    </div>

                    <div class="upt-tooltip-budget-box ${pinType}">
                        <div class="upt-tooltip-budget-label">Total Pagu Anggaran</div>
                        <div class="upt-tooltip-budget-value">${formatRupiah(totalPagu)}</div>
                        <span class="badge ${loc.isPusat ? 'bg-warning text-dark' : 'bg-primary text-white'} fw-bold rounded-pill text-xxs mt-1 px-2.5">
                            ${formatShortRupiah(totalPagu)}
                        </span>
                    </div>

                    <div class="upt-tooltip-stats-row">
                        <span>Realisasi Belanja:</span>
                        <strong class="text-success">${formatRupiah(totalRealisasi)} (${serapan}%)</strong>
                    </div>

                    <div class="upt-tooltip-stats-row">
                        <span>Jumlah Paket:</span>
                        <span class="text-white fw-bold">${matched.length} Paket (${jalanCount} Jalan, ${jembatanCount} Jembatan)</span>
                    </div>

                    <div class="upt-tooltip-hint">
                        <i class="bi bi-cursor-fill text-warning"></i> Klik marker untuk detail keseluruhan
                    </div>
                </div>
            `;

            marker.bindTooltip(tooltipContent, {
                direction: 'top',
                offset: [0, -28],
                className: 'upt-custom-tooltip',
                opacity: 1
            });

            // Popup on Map
            const popupContent = `
                <div style="min-width: 250px; font-family: 'Poppins', sans-serif;">
                    <div class="d-flex align-items-center gap-2 mb-1.5">
                        <div class="rounded-circle ${loc.isPusat ? 'bg-warning-subtle text-warning' : 'bg-primary-subtle text-primary'} p-1.5 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi ${pinIcon}" style="font-size: 1rem;"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size: 0.88rem;">${loc.name}</h6>
                            <div class="text-muted text-xxs" style="font-size: 0.7rem;">${loc.wilayah}</div>
                        </div>
                    </div>
                    
                    <div class="bg-light p-2.5 rounded-3 mb-2 border">
                        <div class="d-flex justify-content-between text-xs mb-1">
                            <span class="text-secondary">Pagu Anggaran:</span>
                            <strong class="text-primary">${formatRupiah(totalPagu)}</strong>
                        </div>
                        <div class="d-flex justify-content-between text-xs mb-1">
                            <span class="text-secondary">Realisasi:</span>
                            <strong class="text-success">${formatRupiah(totalRealisasi)} (${serapan}%)</strong>
                        </div>
                        <div class="d-flex justify-content-between text-xs">
                            <span class="text-secondary">Rincian:</span>
                            <span class="fw-semibold text-dark">${matched.length} Paket (${jalanCount} Jalan, ${jembatanCount} Jembatan)</span>
                        </div>
                    </div>

                    <div class="d-flex flex-column gap-1.5">
                        <button type="button" class="btn btn-primary btn-sm w-100 py-1.5 text-xs fw-semibold rounded-pill shadow-xs" onclick="openUptDetailModal('${loc.id}')">
                            <i class="bi bi-arrows-fullscreen me-1.5"></i> Buka Detail Keseluruhan
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm w-100 py-1 text-xs rounded-pill" onclick="filterPaketByUpt('${loc.name}')">
                            <i class="bi bi-table me-1"></i> Lihat Data Paket
                        </button>
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent);
            marker.uptId = loc.id;

            // Click event on marker: Focus map and open comprehensive detail modal
            marker.on('click', function() {
                focusUptOnMap(loc.id, false);
                openUptDetailModal(loc.id);
            });

            paketMapMarkers.push(marker);

            // Card item for side list with dedicated "Detail" button
            cardListHtml += `
                <div class="upt-map-card" onclick="focusUptOnMap('${loc.id}')" id="upt-card-${loc.id}">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <div class="fw-bold text-dark text-xs">${loc.name}</div>
                        <span class="badge ${loc.isPusat ? 'bg-warning-subtle text-warning border border-warning-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'} rounded-pill" style="font-size: 0.65rem;">
                            ${matched.length} Paket
                        </span>
                    </div>
                    <div class="text-muted mb-1.5 text-truncate" style="font-size: 0.68rem;">${loc.wilayah}</div>
                    <div class="d-flex justify-content-between align-items-center text-xs pt-1.5 border-top">
                        <div>
                            <span class="text-muted" style="font-size: 0.66rem;">Pagu: </span>
                            <span class="fw-bold text-dark" style="font-size: 0.75rem;">${formatShortRupiah(totalPagu)}</span>
                        </div>
                        <button type="button" class="btn btn-outline-primary btn-xs rounded-pill px-2 py-0.5 fw-semibold" style="font-size: 0.65rem;" onclick="event.stopPropagation(); openUptDetailModal('${loc.id}');" title="Buka Detail Keseluruhan">
                            <i class="bi bi-eye me-1"></i>Detail
                        </button>
                    </div>
                </div>
            `;
        });

        if (cardListContainer) {
            cardListContainer.innerHTML = cardListHtml;
        }

        setTimeout(() => {
            if (paketMap) paketMap.invalidateSize();
        }, 150);
    }

    window.focusUptOnMap = function(uptId, shouldOpenPopup = true) {
        const loc = UPT_LOCATIONS.find(l => l.id === uptId);
        if (!loc || !paketMap) return;

        // Highlight selected card
        document.querySelectorAll('.upt-map-card').forEach(c => c.classList.remove('active'));
        const activeCard = document.getElementById(`upt-card-${uptId}`);
        if (activeCard) activeCard.classList.add('active');

        // Sync dropdown
        const uptSelect = document.getElementById('peta-upt-select');
        if (uptSelect) uptSelect.value = uptId;

        // Fly to coordinate and optionally open popup
        paketMap.flyTo([loc.lat, loc.lng], 11, { duration: 1.2 });
        if (shouldOpenPopup) {
            const marker = paketMapMarkers.find(m => m.uptId === uptId);
            if (marker) {
                setTimeout(() => { marker.openPopup(); }, 1200);
            }
        }
    };

    window.openUptDetailModal = function(uptId) {
        const loc = UPT_LOCATIONS.find(l => l.id === uptId);
        if (!loc) return;

        const baseData = getActivePaketBaseData();
        const matched = baseData.filter(r => {
            const bu = (r.bidangUpt || '').toUpperCase();
            return loc.aliases.some(a => bu.includes(a));
        });

        const totalPagu = matched.reduce((a, b) => a + (b.anggaran || 0), 0);
        const totalRealisasi = matched.reduce((a, b) => a + (b.realisasi || 0), 0);
        const sisaPagu = Math.max(0, totalPagu - totalRealisasi);
        const serapanPct = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : '0';

        // Update Modal Header
        const elHeader = document.getElementById('modal-upt-header');
        const elTitle = document.getElementById('uptMapDetailModalLabel');
        const elSubtitle = document.getElementById('modal-upt-subtitle');
        const elTag = document.getElementById('modal-upt-tag');
        const elIcon = document.getElementById('modal-upt-icon');

        if (elTitle) elTitle.textContent = loc.name;
        if (elSubtitle) elSubtitle.textContent = `Wilayah Kerja: ${loc.wilayah} | Posisi: ${loc.lat}, ${loc.lng}`;
        if (elTag) {
            elTag.textContent = loc.isPusat ? 'Kantor Dinas & Bidang Teknis' : 'UPT Wilayah Kerja';
            elTag.className = loc.isPusat ? 'badge bg-warning text-dark fw-bold rounded-pill text-xxs' : 'badge bg-white text-primary fw-semibold rounded-pill text-xxs';
        }
        if (elIcon) {
            elIcon.className = loc.isPusat ? 'bi bi-building-fill fs-4' : 'bi bi-geo-alt-fill fs-4';
        }
        if (elHeader) {
            elHeader.style.background = loc.isPusat 
                ? 'linear-gradient(135deg, #b45309, #d97706, #f59e0b)' 
                : 'linear-gradient(135deg, #1e40af, #2563eb, #0ea5e9)';
        }

        // Setup "Buka di Tabel Paket" footer button
        const btnGoto = document.getElementById('btn-modal-upt-goto-paket');
        if (btnGoto) {
            btnGoto.onclick = function() {
                const modalEl = document.getElementById('uptMapDetailModal');
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
                filterPaketByUpt(loc.name);
            };
        }

        // Breakdown categories
        const catCounts = { jalan: 0, jembatan: 0, pemeliharaan: 0, teknis: 0, lainnya: 0 };
        const catPagu = { jalan: 0, jembatan: 0, pemeliharaan: 0, teknis: 0, lainnya: 0 };
        matched.forEach(r => {
            const cat = getPaketCategory(r.subkegiatan);
            catCounts[cat] = (catCounts[cat] || 0) + 1;
            catPagu[cat] = (catPagu[cat] || 0) + (r.anggaran || 0);
        });

        // Build Modal Body HTML
        const modalBody = document.getElementById('modal-upt-detail-body');
        if (!modalBody) return;

        let rowsHtml = '';
        if (matched.length === 0) {
            rowsHtml = `
                <tr>
                    <td colspan="8" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-3 d-block mb-1 text-secondary"></i>
                        Tidak ada data paket pekerjaan untuk wilayah ini pada filter aktif saat ini.
                    </td>
                </tr>
            `;
        } else {
            matched.forEach((r, idx) => {
                const cat = getPaketCategory(r.subkegiatan);
                const badge = getPaketCategoryBadge(cat);
                const targetText = r.nilaiIndikator > 0 
                    ? `${(r.nilaiIndikator % 1 === 0 ? r.nilaiIndikator : r.nilaiIndikator.toFixed(2)).toLocaleString('id-ID')} ${r.satuan || ''}` 
                    : '-';
                const rowPct = r.anggaran > 0 ? ((r.realisasi / r.anggaran) * 100).toFixed(1) : '0';
                let pctClass = 'badge bg-secondary-subtle text-secondary';
                if (rowPct >= 80) pctClass = 'badge bg-success-subtle text-success border border-success-subtle';
                else if (rowPct > 0) pctClass = 'badge bg-warning-subtle text-warning border border-warning-subtle';

                rowsHtml += `
                    <tr class="modal-upt-row" data-subkeg="${(r.subkegiatan || '').toLowerCase()}">
                        <td class="text-center text-secondary fw-semibold">${idx + 1}</td>
                        <td>${badge}</td>
                        <td>
                            <div class="fw-bold text-dark text-xs mb-0.5">${r.subkegiatan}</div>
                            <div class="text-muted" style="font-size: 0.68rem;">${r.indikator || '-'}</div>
                        </td>
                        <td class="text-end text-xs fw-semibold text-secondary">${targetText}</td>
                        <td class="text-end text-xs fw-bold text-primary">${formatRupiah(r.anggaran || 0)}</td>
                        <td class="text-end text-xs fw-bold text-success">${formatRupiah(r.realisasi || 0)}</td>
                        <td class="text-center">
                            <span class="${pctClass} rounded-pill px-2 py-0.5" style="font-size: 0.7rem;">${rowPct}%</span>
                        </td>
                        <td class="text-center">
                            <button class="btn btn-xs btn-outline-primary rounded-pill py-1 px-2.5" onclick="showRowDetails(${r.no})" title="Lihat Rincian Lengkap">
                                <i class="bi bi-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        modalBody.innerHTML = `
            <!-- Top KPI Overview Cards -->
            <div class="row g-3 mb-4">
                <div class="col-12 col-sm-6 col-xl-3">
                    <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-muted text-xxs text-uppercase fw-bold tracking-wide">Pagu Anggaran</span>
                            <div class="rounded-circle bg-primary-subtle text-primary p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-wallet2 text-xs"></i>
                            </div>
                        </div>
                        <div class="h5 fw-bold text-dark mb-1 text-truncate" title="${formatRupiah(totalPagu)}">${formatRupiah(totalPagu)}</div>
                        <div class="d-flex align-items-center gap-1.5 text-xs text-muted">
                            <span class="badge bg-primary-subtle text-primary fw-semibold rounded-pill text-xxs">${formatShortRupiah(totalPagu)}</span>
                            <span>Total alokasi pagu</span>
                        </div>
                    </div>
                </div>

                <div class="col-12 col-sm-6 col-xl-3">
                    <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-muted text-xxs text-uppercase fw-bold tracking-wide">Realisasi Belanja</span>
                            <div class="rounded-circle bg-success-subtle text-success p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-cash-coin text-xs"></i>
                            </div>
                        </div>
                        <div class="h5 fw-bold text-success mb-1 text-truncate" title="${formatRupiah(totalRealisasi)}">${formatRupiah(totalRealisasi)}</div>
                        <div class="d-flex align-items-center gap-1.5 text-xs text-muted">
                            <span class="badge bg-success-subtle text-success border border-success-subtle fw-bold rounded-pill text-xxs">${serapanPct}%</span>
                            <span>Tingkat serapan belanja</span>
                        </div>
                    </div>
                </div>

                <div class="col-12 col-sm-6 col-xl-3">
                    <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-muted text-xxs text-uppercase fw-bold tracking-wide">Sisa Pagu Anggaran</span>
                            <div class="rounded-circle bg-info-subtle text-info p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-pie-chart-fill text-xs"></i>
                            </div>
                        </div>
                        <div class="h5 fw-bold text-dark mb-1 text-truncate" title="${formatRupiah(sisaPagu)}">${formatRupiah(sisaPagu)}</div>
                        <div class="d-flex align-items-center gap-1.5 text-xs text-muted">
                            <span class="badge bg-info-subtle text-info fw-semibold rounded-pill text-xxs">${formatShortRupiah(sisaPagu)}</span>
                            <span>Belum dibelanjakan</span>
                        </div>
                    </div>
                </div>

                <div class="col-12 col-sm-6 col-xl-3">
                    <div class="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-muted text-xxs text-uppercase fw-bold tracking-wide">Total Paket Fisik & Teknis</span>
                            <div class="rounded-circle bg-warning-subtle text-warning p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-cone-striped text-xs"></i>
                            </div>
                        </div>
                        <div class="h5 fw-bold text-dark mb-1">${matched.length} Paket</div>
                        <div class="text-xs text-muted">
                            <span class="fw-semibold text-dark">${catCounts.jalan}</span> Jalan &bull; <span class="fw-semibold text-dark">${catCounts.jembatan}</span> Jembatan
                        </div>
                    </div>
                </div>
            </div>

            <!-- Kategori Pekerjaan Distribution Cards -->
            <div class="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
                <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
                    <div class="fw-bold text-dark text-xs d-flex align-items-center gap-1.5">
                        <i class="bi bi-tags-fill text-primary"></i> Ringkasan Distribusi Kategori Pekerjaan
                    </div>
                    <span class="text-muted text-xxs">Total: ${matched.length} Paket</span>
                </div>
                <div class="row g-2 pt-1">
                    <div class="col-6 col-md-3">
                        <div class="p-2.5 rounded-3 bg-light border">
                            <div class="text-muted text-xxs mb-0.5">Pembangunan Jalan</div>
                            <div class="fw-bold text-dark text-xs">${catCounts.jalan} Paket</div>
                            <div class="text-primary fw-semibold" style="font-size: 0.72rem;">${formatShortRupiah(catPagu.jalan)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-2.5 rounded-3 bg-light border">
                            <div class="text-muted text-xxs mb-0.5">Jembatan</div>
                            <div class="fw-bold text-dark text-xs">${catCounts.jembatan} Paket</div>
                            <div class="text-info fw-semibold" style="font-size: 0.72rem;">${formatShortRupiah(catPagu.jembatan)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-2.5 rounded-3 bg-light border">
                            <div class="text-muted text-xxs mb-0.5">Pemeliharaan Jalan</div>
                            <div class="fw-bold text-dark text-xs">${catCounts.pemeliharaan} Paket</div>
                            <div class="text-warning fw-semibold" style="font-size: 0.72rem;">${formatShortRupiah(catPagu.pemeliharaan)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-2.5 rounded-3 bg-light border">
                            <div class="text-muted text-xxs mb-0.5">Teknis & Penunjang</div>
                            <div class="fw-bold text-dark text-xs">${catCounts.teknis + catCounts.lainnya} Paket</div>
                            <div class="text-secondary fw-semibold" style="font-size: 0.72rem;">${formatShortRupiah(catPagu.teknis + catPagu.lainnya)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Table of all Packages -->
            <div class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div class="p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                    <div>
                        <h6 class="fw-bold text-dark mb-0 text-sm">Daftar Paket Pekerjaan (${matched.length})</h6>
                        <p class="text-muted text-xxs mb-0">Seluruh rincian paket kegiatan di wilayah ${loc.name}</p>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <div class="input-group input-group-sm" style="max-width: 260px;">
                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
                            <input type="text" class="form-control bg-light border-start-0 text-xs" id="modal-upt-table-search" placeholder="Cari paket di wilayah ini...">
                        </div>
                    </div>
                </div>

                <div class="table-responsive" style="max-height: 380px;">
                    <table class="table table-hover align-middle mb-0" id="modal-upt-table">
                        <thead class="table-light text-xxs text-uppercase fw-semibold text-secondary sticky-top">
                            <tr>
                                <th class="text-center" style="width: 45px;">No</th>
                                <th style="width: 140px;">Kategori</th>
                                <th>Subkegiatan / Rincian Paket</th>
                                <th class="text-end" style="width: 110px;">Target</th>
                                <th class="text-end" style="width: 140px;">Pagu Anggaran</th>
                                <th class="text-end" style="width: 140px;">Realisasi</th>
                                <th class="text-center" style="width: 85px;">Serapan</th>
                                <th class="text-center" style="width: 60px;">Rincian</th>
                            </tr>
                        </thead>
                        <tbody id="modal-upt-table-tbody" class="border-top-0">
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Search filter inside modal table
        const searchInput = document.getElementById('modal-upt-table-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const query = this.value.toLowerCase().trim();
                const rows = modalBody.querySelectorAll('.modal-upt-row');
                rows.forEach(r => {
                    const text = r.innerText.toLowerCase();
                    if (query === '' || text.includes(query)) {
                        r.style.display = '';
                    } else {
                        r.style.display = 'none';
                    }
                });
            });
        }

        // Show the modal
        const modalEl = document.getElementById('uptMapDetailModal');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        }
    };

    window.filterPaketByUpt = function(uptName) {
        // Switch to Paket Tab cleanly
        if (typeof activateDashboardTab === 'function') {
            activateDashboardTab('jj-paket-tab');
        } else {
            const paketTabBtn = document.getElementById('jj-paket-tab');
            if (paketTabBtn) {
                const trigger = bootstrap.Tab.getOrCreateInstance(paketTabBtn);
                trigger.show();
            }
        }

        // Set search query in paket tab to filter by this UPT
        const searchInput = document.getElementById('paket-search-input');
        if (searchInput) {
            searchInput.value = uptName.replace('UPT PJJ ', '');
            searchInput.dispatchEvent(new Event('input'));
        }
    };

    window.exportPaketData = function() {
        const baseData = state.filteredData.filter(r => 
            r.program === 'Program Penyelenggaraan Jalan' || 
            /jalan|jembatan/i.test(r.subkegiatan || '')
        );
        let filtered = baseData;
        if (paketState.categoryFilter !== 'all') {
            filtered = filtered.filter(r => getPaketCategory(r.subkegiatan) === paketState.categoryFilter);
        }
        if (paketState.searchQuery.trim() !== '') {
            const q = paketState.searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                (r.subkegiatan && r.subkegiatan.toLowerCase().includes(q)) ||
                (r.bidangUpt && r.bidangUpt.toLowerCase().includes(q)) ||
                (r.indikator && r.indikator.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            alert('Tidak ada data paket untuk diekspor.');
            return;
        }

        let csv = 'No,Kategori,Subkegiatan,Indikator,Satuan,Target_Fisik,Bidang_UPT,Tahun,Jenis_Anggaran,Pagu_Anggaran,Realisasi_Anggaran,Capaian_Persen\n';
        filtered.forEach((r, idx) => {
            const cat = getPaketCategory(r.subkegiatan);
            const pct = r.anggaran > 0 ? ((r.realisasi / r.anggaran) * 100).toFixed(2) : 0;
            const clean = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
            csv += `${idx + 1},${clean(cat)},${clean(r.subkegiatan)},${clean(r.indikator)},${clean(r.satuan)},${r.nilaiIndikator || 0},${clean(r.bidangUpt)},${r.tahun},${clean(r.jenisAnggaran)},${r.anggaran || 0},${r.realisasi || 0},${pct}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Paket_Jalan_dan_Jembatan_${state.activeFilters.tahun || 'All'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 13. Run Initialization (Executed after all modules & states are fully defined)
    initFilterOptions();
    applyFilters();

    window.addEventListener('resize', adjustStickyOffsets);
});
