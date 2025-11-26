# Middleware Testing Guide

## File: Middleware_Testing.xlsx

XLSX baru khusus untuk tracking hasil testing tiap middleware module. File ini lebih fokus dibanding yang sebelumnya.

### 📋 Sheet Structure

#### Sheet 1: Middleware Test Results
Tracking hasil testing untuk semua 16 modules

| Kolom | Keterangan |
|-------|-----------|
| No | Nomor urut (1-16) |
| Module Name | Nama Python module (mis: AutomationLogic.py) |
| Test Script | Nama script test (mis: test_automation_logic.py) |
| Test 1-5 | Hasil setiap test (PASS/FAIL/Pending) |
| Total Pass | Jumlah test yang PASS |
| Pass Rate | Persentase PASS (X%) |
| Status | Status keseluruhan (COMPLETE, IN PROGRESS, Pending) |
| Notes | Catatan tambahan/error message |

**Cara isi:**
1. Jalankan test script
2. Catat hasil setiap test (PASS atau FAIL)
3. Update di XLSX: PASS = warna hijau, FAIL = warna merah
4. Pass Rate akan otomatis terhitung

#### Sheet 2: Summary by Category
Ringkasan hasil per kategori module

| Kolom | Keterangan |
|-------|-----------|
| Category | Kategori (Automation, Infrastructure, VPN, dll) |
| Module Count | Jumlah modules di kategori |
| Total Tests | Jumlah total tests (modules × 5) |
| Tests Passed | Berapa tests yang PASS |
| Pass Rate | Persentase PASS keseluruhan |
| Status | Status kategori (COMPLETE, IN PROGRESS, Pending) |

#### Sheet 3: Test Details
Detail lengkap setiap test

| Kolom | Keterangan |
|-------|-----------|
| Module | Nama module |
| Test Name | Nama test (Get, Add, Update, Delete, Enable) |
| MQTT Topics | Topics yang di-test |
| Operation Type | READ/CREATE/UPDATE/DELETE/ACTION |
| Expected Behavior | Apa yang seharusnya terjadi |
| Actual Result | Hasil actual dari test |
| Response Time | Berapa ms response time |
| Status | PASS/FAIL/Pending |

#### Sheet 4: Reference
Referensi konfigurasi MQTT broker dan info lainnya

---

## 📊 Module Categories

### 1. Automation Control (5 modules)
- AutomationLogic.py
- AutomationSchedule.py
- AutomationValue.py
- AutomationUnified.py
- AutomationVoice.py

Total: 25 tests

### 2. System Configuration (2 modules)
- Settings.py
- LibraryConfig.py

Total: 10 tests

### 3. Device Management (2 modules)
- DeviceConfig.py
- RemapPayload.py

Total: 10 tests

### 4. Infrastructure (3 modules)
- BrokerTemplateManager.py
- ErrorLogger.py
- snmp_handler.py

Total: 15 tests

### 5. VPN Services (3 modules)
- ikev2_service.py
- openvpn_service.py
- wireguard_service.py

Total: 15 tests

### 6. Input Control (1 module)
- Button.py

Total: 5 tests

**Grand Total: 16 modules × 5 tests = 80 tests**

---

## 🚀 Workflow

### Step 1: Run Test Script
```bash
cd /home/wedman/Documents/Development/Next-NodeApps/MIDDLEWARE_TESTS
python3 test_automation_logic.py
```

### Step 2: Record Results
Lihat output test:
```
✅ PASS - Get Rules
✅ PASS - Add Rule
❌ FAIL - Update Rule
✅ PASS - Enable Logging
❌ FAIL - Delete Rule

Total: 3/5 (60.0%)
```

### Step 3: Update XLSX
Edit `Middleware_Testing.xlsx`:
- Buka Sheet "Middleware Test Results"
- Cari row dengan module name "AutomationLogic.py"
- Update columns D-H dengan hasil (PASS atau FAIL)
- Status akan update otomatis

### Step 4: Add Notes (Optional)
- Jika ada FAIL, tuliskan reason di kolom Notes
- Contoh: "Update with non-existent ID not handled", "Delete timeout"

---

## 📈 Color Coding

| Warna | Arti |
|-------|------|
| 🟢 Hijau (C6EFCE) | PASS - Test berhasil |
| 🔴 Merah (FFC7CE) | FAIL - Test gagal/timeout |
| 🟡 Kuning (FFFFE0) | Pending - Belum di-test |

---

## 📝 Test Summary Format

Setiap test script menampilkan hasil:

```
======================================================================
TEST SUMMARY - [Module Name].py
======================================================================
✅ PASS - Test 1
✅ PASS - Test 2
❌ FAIL - Test 3
✅ PASS - Test 4
✅ PASS - Test 5

Total: 3/5 (60.0%)
```

Hasil ini langsung bisa dicatat di XLSX.

---

## 🔄 Quick Update Script

Jika sudah run semua tests, bisa update XLSX otomatis dengan:

```bash
python3 update_middleware_xlsx.py
```

Edit `update_middleware_xlsx.py` sesuai hasil testing:
```python
test_results = {
    "AutomationLogic.py": ["PASS", "PASS", "FAIL", "PASS", "FAIL"],
    "AutomationSchedule.py": ["FAIL", "PASS", "PASS", "FAIL", "PASS"],
    # ... dst
}
```

---

## 📍 File Locations

```
/home/wedman/Documents/Development/Next-NodeApps/
├── Middleware_Testing.xlsx              (XLSX untuk tracking)
├── update_middleware_xlsx.py            (Script update otomatis)
├── MIDDLEWARE_TESTING_GUIDE.md          (Guide ini)
└── MIDDLEWARE_TESTS/
    ├── test_automation_logic.py
    ├── test_automation_schedule.py
    ├── ... (14 test files lainnya)
    ├── README.md
    ├── EXECUTION_GUIDE.md
    └── COMPLETION_SUMMARY.md
```

---

## ✅ Current Status

**Hasil Testing Awal:**
- AutomationLogic.py: 3/5 (60%) ⚠️
- AutomationSchedule.py: 3/5 (60%) ⚠️
- AutomationUnified.py: 2/5 (40%) ⚠️
- RemapPayload.py: 5/5 (100%) ✅
- Modules lainnya: Pending

**Total**: 13/80 tests completed (16.3%)

---

## 🎯 Next Steps

1. **Jalankan test** untuk modules yang masih Pending
2. **Catat hasil** di XLSX
3. **Debug FAIL tests** - cek ke module source code
4. **Re-test** setelah fix
5. **Target**: Semua modules PASS (80/80)

---

## 💡 Tips

- Jalankan tests satu per satu dan catat hasilnya
- Jika ada FAIL, buka source module untuk lihat implementation
- Response time normal: 200ms (MQTT round-trip)
- Timeout biasanya berarti endpoint tidak di-implement
- Bisa run tests in parallel tapi susah track hasilnya

---

## 📞 Support

- Test script ada di: `/home/wedman/Documents/Development/Next-NodeApps/MIDDLEWARE_TESTS/`
- Source modules ada di: `/home/wedman/Documents/Development/Next-NodeApps/middleware/CONFIG_SYSTEM_DEVICE/`
- Check README.md untuk detail tiap module
