# Feature Registry and Change Impact Map

Feature definitions live in `src/ui/feature-registry.ts`. This document is generated from that source and checked by `tests/ui-registry.test.ts`; do not hand-edit it. UI definitions and exact element locations are in [UI_REGISTRY.md](./UI_REGISTRY.md).

## At a glance

| Feature ID | Feature | Route/surface | Purpose | Status |
|---|---|---|---|---|
| A001 | Editor | `/editor` | تحرير اختلافات القراءة وأوجهها وعلاقاتها، ثم مراجعة ناتج محرك التشجير وحفظ المستند. | active |
| A002 | Engine Studio | `/studio` | واجهة رسومية لسياسات المحرك والقواعد ومصفوفة الدمج والأولويات والتفسير والاختبار والنشر والاستيراد والتصدير. | active |
| A003 | Quran View | `/quran` | قراءة النص العثماني حسب السورة، مع عرض التشجير المحفوظ أو المشتق وروابط التحرير والتصدير. | active |
| A004 | Tracking | `/tracking` | مقارنة ما وجده المحرك بما أضافه أو صححه المحرر، مع أثر القرار وروابط العودة إلى موضع التحرير. | active |
| A005 | Variant and Rule Index | `/variants` | فهرسة الاختلافات والقواعد العامة مع البحث والتصفية وروابط التحرير. | active |
| A006 | Qiraat Catalog | `/qiraat` | استعراض القراءات العشر واختيار قراءة لعرض بياناتها. | active |
| A007 | Readers Catalog | `/readers` | استعراض وإدارة ملفات القراء وإجازاتهم ضمن تنفيذ التخزين الحالي. | active |
| A008 | Scientific Review | `/review` | قائمة المراجعة العلمية المحلية وما يرتبط بها من تحديث حالة أو ملاحظات. | active |
| A009 | Transmission Administration | `/admin` | إدارة الأئمة والرواة والطرق محليا، مع تبويب قديم يحيل إعدادات المحرك إلى الاستوديو. | active |
| A010 | Settings | `/settings` | عرض وإدارة إعدادات مساحة العمل الحالية. | active |
| A011 | Statistics | `/statistics` | لوحة قراءة إحصائية للتغطية والمواضع والفئات والرواة والمستندات. | active |
| A012 | Public Landing | `/` | صفحة تعريف عامة تعرض قيمة المشروع وروابط الوصول إلى مساحات العمل. | active |
| A013 | Local Sign-in | `/login` | واجهة دخول محلية تحفظ شارة الجلسة في المتصفح ولا ترسل بيانات إلى خادم. | active |
| A014 | UI ID Inspector | `all routes via ?uiInspector=1` | واجهة فحص صريحة تعرض معرفات DOM المسجلة وبيانات السجل الفعلية عند طلب المستخدم، وتبقى مخفية عن المظهر المعتاد. | active |
| A015 | Dashboard Workspace Shell | `shared-dashboard` | الغلاف المشترك لمسارات مساحة العمل: التنقل المتجاوب، رابط المصحف، شارة الجلسة، وحاوية التأكيد. | active |

## Feature details

## A001 — Editor

- **Route/surface:** `/editor`
- **Status:** `active`
- **Purpose:** تحرير اختلافات القراءة وأوجهها وعلاقاتها، ثم مراجعة ناتج محرك التشجير وحفظ المستند.
- **Important child UI IDs:** `A020`, `A100`, `A111`, `A130`, `A1259`, `A1260`, `A1261`, `A1262`, `A1263`, `A1264`, `A1265`, `A1266`, `A1267`, `A1268`, `A1269`, `A1431`, `A1432`, `A1433`, `A1434`, `A1435`, `A1436`, `A1437`, `A1438`, `A1439`, `A1440`, `A1441`, `A1442`, `A112`, `A101`, `A102`, `A745`, `A746`, `A747`, `A103`, `A104`, `A105`, `A967`, `A968`, `A969`, `A970`, `A106`, `A740`, `A741`, `A742`, `A743`, `A744`, `A135`, `A136`, `A137`, `A754`, `A755`, `A756`, `A757`, `A758`, `A759`, `A760`, `A761`, `A762`, `A763`, `A748`, `A749`, `A750`, `A751`, `A752`, `A753`, `A764`, `A765`, `A766`, `A767`, `A768`, `A769`, `A770`, `A771`, `A772`, `A773`, `A774`, `A775`, `A776`, `A777`, `A778`, `A779`, `A780`, `A781`, `A782`, `A783`, `A784`, `A785`, `A786`, `A787`, `A788`, `A107`, `A108`, `A733`, `A109`, `A734`, `A110`, `A735`, `A736`, `A737`, `A738`, `A739`, `A113`, `A128`, `A123`, `A124`, `A125`, `A126`, `A127`, `A977`, `A2125`, `A971`, `A972`, `A973`, `A974`, `A975`, `A976`, `A978`, `A1130`, `A1131`, `A1132`, `A1133`, `A1134`, `A1135`, `A1136`, `A1137`, `A1138`, `A1139`, `A1140`, `A1141`, `A1142`, `A1143`, `A1144`, `A1145`, `A1146`, `A1147`, `A1148`, `A1149`, `A1150`, `A1151`, `A1152`, `A1153`, `A1154`, `A1155`, `A1156`, `A1157`, `A1158`, `A1159`, `A1160`, `A1161`, `A1162`, `A1163`, `A1164`, `A1165`, `A1166`, `A1167`, `A1168`, `A1169`, `A1170`, `A1171`, `A1172`, `A1173`, `A1174`, `A1175`, `A1176`, `A1177`, `A1178`, `A1179`, `A1180`, `A1181`, `A1182`, `A1183`, `A1184`, `A1185`, `A1186`, `A1187`, `A1188`, `A1189`, `A1190`, `A129`, `A1270`, `A1271`, `A1272`, `A1273`, `A1274`, `A1275`, `A1276`, `A1277`, `A1278`, `A1279`, `A1280`, `A1281`, `A1282`, `A1283`, `A1284`, `A1285`, `A1286`, `A1287`, `A1288`, `A1289`, `A1290`, `A1291`, `A1292`, `A1293`, `A1294`, `A139`, `A1050`, `A1051`, `A1052`, `A1053`, `A1054`, `A1055`, `A1056`, `A1057`, `A1058`, `A1059`, `A1060`, `A1061`, `A1062`, `A1063`, `A1064`, `A1065`, `A1066`, `A1067`, `A1068`, `A1069`, `A1070`, `A1071`, `A1072`, `A1073`, `A1074`, `A1075`, `A1076`, `A1077`, `A1078`, `A1079`, `A1080`, `A1081`, `A1082`, `A1083`, `A1084`, `A1085`, `A1086`, `A1087`, `A1088`, `A1089`, `A1090`, `A1091`, `A1092`, `A1093`, `A1094`, `A1095`, `A1096`, `A1097`, `A1098`, `A1099`, `A1100`, `A1101`, `A1102`, `A1103`, `A1104`, `A1105`, `A1106`, `A1107`, `A1108`, `A1109`, `A1110`, `A1111`, `A1112`, `A1113`, `A1114`, `A1115`, `A1116`, `A1117`, `A1118`, `A1119`, `A1120`, `A1121`, `A1122`, `A1123`, `A1124`, `A1125`, `A1126`, `A1127`, `A1128`, `A1129`, `A1005`, `A1006`, `A1007`, `A1008`, `A1009`, `A1010`, `A1011`, `A1012`, `A1013`, `A1014`, `A1015`, `A1016`, `A1017`, `A1018`, `A1019`, `A1020`, `A1021`, `A1022`, `A1023`, `A1024`, `A1025`, `A1026`, `A1027`, `A1028`, `A1029`, `A1030`, `A1031`, `A1032`, `A1033`, `A1034`, `A1035`, `A1036`, `A1037`, `A1038`, `A1039`, `A1040`, `A1041`, `A1042`, `A1043`, `A1044`, `A1045`, `A1046`, `A1047`, `A1048`, `A1049`, `A1593`, `A1594`, `A1595`, `A1596`, `A1597`, `A1598`, `A1599`, `A1600`, `A1601`, `A1602`, `A1603`, `A1604`, `A1605`, `A1606`, `A1607`, `A1608`, `A1609`, `A1610`, `A114`, `A115`, `A116`, `A117`, `A118`, `A121`, `A122`, `A1585`, `A119`, `A333`, `A1577`, `A1578`, `A140`, `A141`, `A144`, `A979`, `A980`, `A981`, `A982`, `A983`, `A984`, `A985`, `A986`, `A987`, `A988`, `A989`, `A990`, `A991`, `A992`, `A993`, `A994`, `A995`, `A996`, `A997`, `A998`, `A999`, `A1000`, `A1191`, `A1192`, `A1193`, `A1194`, `A1195`, `A1196`, `A1197`, `A1198`, `A1199`, `A1200`, `A1201`, `A1202`, `A1203`, `A1204`, `A1205`, `A1206`, `A1207`, `A1208`, `A1209`, `A1210`, `A1211`, `A1212`, `A1213`, `A1214`, `A1215`, `A1216`, `A1217`, `A1218`, `A1219`, `A1220`, `A1221`, `A1222`, `A1223`, `A1224`, `A1225`, `A1226`, `A143`, `A929`, `A930`, `A931`, `A932`, `A933`, `A934`, `A935`, `A936`, `A937`, `A938`, `A939`, `A940`, `A941`, `A942`, `A943`, `A944`, `A945`, `A946`, `A947`, `A948`, `A949`, `A950`, `A951`, `A952`, `A953`, `A954`, `A955`, `A956`, `A957`, `A958`, `A959`, `A960`, `A961`, `A962`, `A963`, `A964`, `A965`, `A966`, `A1227`, `A1228`, `A1229`, `A1230`, `A1231`, `A1232`, `A1233`, `A1234`, `A1235`, `A1236`, `A1237`, `A1238`, `A1239`, `A1240`, `A1241`, `A1242`, `A1243`, `A1244`, `A1245`, `A1246`, `A1247`, `A1248`, `A1249`, `A1250`, `A1251`, `A1252`, `A1253`, `A1254`, `A1255`, `A1256`, `A1257`, `A1258`, `A142`, `A789`, `A790`, `A791`, `A792`, `A793`, `A794`, `A795`, `A796`, `A797`, `A798`, `A799`, `A800`, `A801`, `A802`, `A803`, `A804`, `A805`, `A806`, `A807`, `A808`, `A809`, `A810`, `A811`, `A812`, `A813`, `A814`, `A815`, `A816`, `A817`, `A818`, `A819`, `A820`, `A821`, `A822`, `A823`, `A824`, `A825`, `A826`, `A827`, `A828`, `A829`, `A830`, `A831`, `A832`, `A833`, `A834`, `A835`, `A836`, `A837`, `A838`, `A839`, `A840`, `A841`, `A842`, `A843`, `A844`, `A845`, `A846`, `A847`, `A848`, `A849`, `A850`, `A851`, `A852`, `A853`, `A854`, `A855`, `A856`, `A857`, `A858`, `A859`, `A860`, `A861`, `A862`, `A863`, `A864`, `A865`, `A866`, `A867`, `A868`, `A869`, `A870`, `A871`, `A872`, `A873`, `A874`, `A875`, `A876`, `A877`, `A878`, `A879`, `A880`, `A881`, `A882`, `A883`, `A884`, `A885`, `A886`, `A887`, `A888`, `A889`, `A890`, `A891`, `A892`, `A893`, `A894`, `A895`, `A896`, `A897`, `A898`, `A899`, `A900`, `A901`, `A902`, `A903`, `A904`, `A905`, `A906`, `A907`, `A908`, `A909`, `A910`, `A911`, `A912`, `A913`, `A914`, `A915`, `A916`, `A917`, `A918`, `A919`, `A920`, `A921`, `A922`, `A923`, `A924`, `A925`, `A926`, `A927`, `A928`, `A145`, `A1570`, `A1571`, `A1572`, `A1573`, `A421`, `A1324`, `A1325`, `A1326`, `A1327`, `A1328`, `A1329`, `A1330`, `A1331`, `A1332`, `A1333`, `A1334`, `A1335`, `A1336`, `A1337`, `A1338`, `A1339`, `A1340`, `A1341`, `A1342`, `A1343`, `A1344`, `A1345`, `A1346`, `A1347`, `A1348`, `A1349`, `A1350`, `A1351`, `A1352`, `A1353`, `A1354`, `A1355`, `A1356`, `A1357`, `A1358`, `A1359`, `A1360`, `A1361`, `A1362`, `A1363`, `A1364`, `A1365`, `A1366`, `A1367`, `A1368`, `A1369`, `A1370`, `A1371`, `A1372`, `A1373`, `A1374`, `A1375`, `A1376`, `A1377`, `A1378`, `A1379`, `A1380`, `A1381`, `A1382`, `A1383`, `A1384`, `A1385`, `A1386`, `A1387`, `A1388`, `A1389`, `A1390`, `A1391`, `A1392`, `A1393`, `A1394`, `A1395`, `A1396`, `A1397`, `A1398`, `A1399`, `A1400`, `A1401`, `A1402`, `A1403`, `A1404`, `A1405`, `A1406`, `A1407`, `A1408`, `A1409`, `A1410`, `A1411`, `A1412`, `A1413`, `A1414`, `A1459`, `A1460`, `A1461`, `A1462`, `A1463`, `A1464`, `A1465`, `A1466`, `A1467`, `A1468`, `A1469`, `A1470`, `A1471`, `A1472`, `A1473`, `A1474`, `A1475`, `A1476`, `A1477`, `A1478`, `A1479`, `A1480`, `A1481`, `A1482`, `A1483`, `A1484`, `A1485`, `A1486`, `A1487`, `A1488`, `A1489`, `A1490`, `A1491`, `A1492`, `A1493`, `A1562`, `A1563`, `A1564`, `A1565`, `A1566`, `A1567`, `A1568`, `A1569`, `A1574`, `A1575`, `A1576`, `A1579`, `A1580`, `A1581`, `A1582`, `A1583`, `A1584`, `A1586`, `A1587`, `A1588`, `A1589`, `A1590`, `A1591`, `A1592`, `A131`, `A1297`, `A1298`, `A1299`, `A1300`, `A1301`, `A1302`, `A1303`, `A1304`, `A1305`, `A1306`, `A1307`, `A1308`, `A1309`, `A1310`, `A1311`, `A1312`, `A1313`, `A1314`, `A1315`, `A1316`, `A1317`, `A1318`, `A1319`, `A1320`, `A1321`, `A1322`, `A1323`, `A132`, `A133`, `A134`, `A1001`, `A1002`, `A1003`, `A1004`, `A1295`, `A1296`, `A1415`, `A1416`, `A1417`, `A1418`, `A1419`, `A1420`, `A1421`, `A1422`, `A1423`, `A1424`, `A1425`, `A1426`, `A1427`, `A1428`, `A1429`, `A1430`, `A1443`, `A1444`, `A1446`, `A1447`, `A1448`, `A1449`, `A1450`, `A1445`, `A1451`, `A1452`, `A1453`, `A1454`, `A1455`, `A1456`, `A1457`, `A1458`, `A1494`, `A1495`, `A1496`, `A1497`, `A1498`, `A1499`, `A1500`, `A1501`, `A1502`, `A1503`, `A1504`, `A1505`, `A1506`, `A1507`, `A1508`, `A1509`, `A1510`, `A1511`, `A1512`, `A1513`, `A1514`, `A1515`, `A1516`, `A1517`, `A1518`, `A1519`, `A1520`, `A1521`, `A1522`, `A1523`, `A1524`, `A1525`, `A1526`, `A1527`, `A1528`, `A1529`, `A1530`, `A1531`, `A1532`, `A1533`, `A1534`, `A1535`, `A1536`, `A1537`, `A1538`, `A1539`, `A1540`, `A1541`, `A1542`, `A1543`, `A1544`, `A1545`, `A1546`, `A1547`, `A1548`, `A1549`, `A1550`, `A1551`, `A1552`, `A1553`, `A1554`, `A1555`, `A1556`, `A1557`, `A1558`, `A1559`, `A1560`, `A1561`, `A1611`, `A1612`, `A1613`
- **Main files:** `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/EditorToolbar.tsx`, `src/components/editor/AyahNavigator.tsx`, `src/components/editor/TashjeerCanvas.tsx`, `src/components/editor/PropertiesPanel.tsx`, `src/components/editor/VariantsPanel.tsx`
- **Main components:** `EditorPage`, `EditorToolbar`, `AyahNavigator`, `TashjeerCanvas`, `PropertiesPanel`, `VariantsPanel`, `SmartCreateWizard`
- **Stores/persistence owners:** `src/stores/editor-store.ts`, `src/lib/editor/selection-store.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/layout-engine.ts`, `src/lib/tashjeer/branch-engine.ts`, `src/lib/tashjeer/smart-create.ts`, `src/lib/tashjeer/clipboard.ts`, `src/lib/tashjeer/bulk-operations.ts`, `src/lib/tashjeer/merge-operations.ts`, `src/lib/tashjeer/manual-links.ts`, `src/lib/tashjeer/selection-commands.ts`
- **Regression tests:** `tests/selection-store.test.ts`, `tests/editor-manual-actions.test.ts`, `tests/editor-bulk-actions.test.ts`, `tests/editor-multi-difference.test.ts`, `tests/package05-multi-difference.test.ts`, `tests/package06-wizard.test.ts`, `tests/package07-acceptance.test.ts`, `tests/e2e/editor-ph3.spec.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A020`, `A100`, `A101`, `A107`, `A111`, `A113`, `A114` | `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/` | Page composition, toolbar, navigator, canvas, properties, and difference panel. |
| Store | `A103`, `A104`, `A129` | `src/stores/editor-store.ts`, `src/lib/editor/selection-store.ts` | Shared document state, undo/redo, selection, clipboard, and panel state. |
| Engine | `A111`, `A123`, `A128` | `src/lib/tashjeer/` | Layout, branch generation, smart-create, ordering, relations, merge, and bulk-operation APIs. UI-only changes must not alter these. |
| Data Model | `A114`, `A121`, `A128` | `src/types/tashjeer.ts`, `src/lib/tashjeer/model/v8.ts` | Document, difference/variant, relation, line/segment, and correction records. |
| Persistence | `A134`, `A143`, `A144` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` | Local document and global-rule storage; only change when the request explicitly reaches persistence. |
| Tests | `A020`, `A333`, `A421` | `tests/editor-*.test.ts`, `tests/package0*.test.ts` | Regression coverage for editing, bulk operations, wizard, undo/redo, and identity mapping. |

## A002 — Engine Studio

- **Route/surface:** `/studio`
- **Status:** `active`
- **Purpose:** واجهة رسومية لسياسات المحرك والقواعد ومصفوفة الدمج والأولويات والتفسير والاختبار والنشر والاستيراد والتصدير.
- **Important child UI IDs:** `A021`, `A150`, `A151`, `A152`, `A153`, `A154`, `A155`, `A619`, `A620`, `A621`, `A622`, `A623`, `A624`, `A625`, `A626`, `A627`, `A628`, `A629`, `A630`, `A156`, `A1695`, `A1696`, `A1697`, `A1698`, `A1699`, `A157`, `A1820`, `A1821`, `A1822`, `A1823`, `A1824`, `A1825`, `A1826`, `A1827`, `A1828`, `A1829`, `A1830`, `A1831`, `A1832`, `A1833`, `A1834`, `A1835`, `A1836`, `A1837`, `A1838`, `A1839`, `A1840`, `A1841`, `A1842`, `A1843`, `A1844`, `A1845`, `A1846`, `A1847`, `A1848`, `A1849`, `A1850`, `A1851`, `A1852`, `A1853`, `A1854`, `A1855`, `A1856`, `A1857`, `A1858`, `A1859`, `A1860`, `A1861`, `A1862`, `A1863`, `A1864`, `A1865`, `A1866`, `A1867`, `A1868`, `A1869`, `A1870`, `A1871`, `A1872`, `A1873`, `A1874`, `A1875`, `A1876`, `A1877`, `A1878`, `A1879`, `A1880`, `A1881`, `A1882`, `A1883`, `A1884`, `A1885`, `A1886`, `A1887`, `A1888`, `A1889`, `A1890`, `A1891`, `A1892`, `A1893`, `A1894`, `A1895`, `A158`, `A159`, `A160`, `A1949`, `A1950`, `A1951`, `A1952`, `A1953`, `A1954`, `A1955`, `A1956`, `A1957`, `A1958`, `A1959`, `A1960`, `A1961`, `A1962`, `A1963`, `A1964`, `A1965`, `A1966`, `A161`, `A1896`, `A1897`, `A1898`, `A2061`, `A1899`, `A2062`, `A1900`, `A2063`, `A1901`, `A2064`, `A1902`, `A2065`, `A1903`, `A1904`, `A1905`, `A2066`, `A1906`, `A2067`, `A1907`, `A1908`, `A1909`, `A1910`, `A1911`, `A1912`, `A1913`, `A1914`, `A1915`, `A1916`, `A1917`, `A1918`, `A1919`, `A1920`, `A1921`, `A1922`, `A1923`, `A1924`, `A1925`, `A1926`, `A1927`, `A1928`, `A1929`, `A1930`, `A1931`, `A1932`, `A1933`, `A1934`, `A1935`, `A1936`, `A1937`, `A1938`, `A1939`, `A1940`, `A1941`, `A1942`, `A1943`, `A1944`, `A1945`, `A1946`, `A1947`, `A1948`, `A2078`, `A2079`, `A2068`, `A2069`, `A2070`, `A2071`, `A2072`, `A2073`, `A2074`, `A2075`, `A2076`, `A2077`, `A162`, `A632`, `A633`, `A634`, `A163`, `A1729`, `A1730`, `A1731`, `A1732`, `A1733`, `A1734`, `A1735`, `A1736`, `A1737`, `A1738`, `A1739`, `A1740`, `A1741`, `A1742`, `A1743`, `A1744`, `A1745`, `A1746`, `A1747`, `A1748`, `A1749`, `A1750`, `A1751`, `A1752`, `A1753`, `A1754`, `A1755`, `A1756`, `A1757`, `A1758`, `A1759`, `A1760`, `A1761`, `A1762`, `A1763`, `A1764`, `A1765`, `A1766`, `A1767`, `A1768`, `A1769`, `A1770`, `A1771`, `A1772`, `A1773`, `A1774`, `A1775`, `A1776`, `A1777`, `A1778`, `A1779`, `A1780`, `A1781`, `A1782`, `A1783`, `A1784`, `A1785`, `A1786`, `A1787`, `A1788`, `A1789`, `A164`, `A1790`, `A1791`, `A1792`, `A1793`, `A1794`, `A1795`, `A1796`, `A1797`, `A1798`, `A1799`, `A1800`, `A1801`, `A1802`, `A1803`, `A165`, `A1970`, `A1971`, `A1972`, `A1973`, `A1974`, `A1975`, `A1976`, `A1977`, `A1978`, `A1979`, `A1980`, `A1981`, `A1982`, `A1983`, `A1984`, `A1985`, `A1986`, `A1987`, `A166`, `A1967`, `A1968`, `A1969`, `A167`, `A1678`, `A2119`, `A1679`, `A2120`, `A1680`, `A2121`, `A1681`, `A2122`, `A1682`, `A1683`, `A1684`, `A1685`, `A1686`, `A1687`, `A1688`, `A1689`, `A1690`, `A1691`, `A1692`, `A1693`, `A1694`, `A168`, `A1804`, `A169`, `A1805`, `A1806`, `A1807`, `A1808`, `A1809`, `A1810`, `A1811`, `A1812`, `A1813`, `A1814`, `A1815`, `A1816`, `A1817`, `A1818`, `A1819`, `A170`, `A1722`, `A1723`, `A1724`, `A1725`, `A1726`, `A1727`, `A1728`, `A171`, `A1700`, `A1701`, `A1702`, `A1703`, `A1704`, `A1705`, `A1706`, `A1707`, `A1708`, `A1709`, `A1710`, `A1711`, `A1712`, `A1713`, `A1714`, `A1715`, `A1716`, `A1717`, `A1718`, `A1719`, `A1720`, `A1721`, `A2080`, `A2081`, `A2082`, `A2083`, `A2084`, `A2085`, `A2086`, `A2087`, `A2088`, `A2089`, `A631`
- **Main files:** `src/app/(dashboard)/studio/page.tsx`, `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts`
- **Main components:** `EngineStudioPage`, `Dashboard`, `RuleExplorer`, `RuleBuilder`, `MergeMatrixPanel`, `PriorityPipeline`, `WhyTracePlayground`, `RuleTestsPanel`, `CandidateRulesPanel`, `ProfileComparePanel`, `PublishHistoryPanel`, `ExportImportPanel`, `EngineSettingsPanel`, `RecitationRuleCatalogPanel`
- **Stores/persistence owners:** `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts`, `src/lib/tashjeer/engine-config-history.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/decision/resolver.ts`, `src/lib/tashjeer/decision/policy.ts`, `src/lib/tashjeer/decision/rule-test-runner.ts`, `src/lib/tashjeer/decision/profile-compare.ts`, `src/lib/tashjeer/decision/profile-audit.ts`, `src/lib/tashjeer/recitation-rule-catalog.ts`
- **Regression tests:** `tests/engine-studio-package02.test.ts`, `tests/engine-studio-policy.test.ts`, `tests/candidate-rule.test.ts`, `tests/decision-resolver.test.ts`, `tests/rule-test-runner.test.ts`, `tests/profile-compare.test.ts`, `tests/engine-config-history.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A021`, `A150`, `A155`, `A158`, `A162`, `A163`, `A168` | `src/app/(dashboard)/studio/page.tsx`, `src/components/studio/` | Section navigation and the selected Engine Studio panel. |
| Store | `A152`, `A154`, `A161` | `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts` | Draft, selected rule, dirty state, persistence, and version history. |
| Engine | `A160`, `A162`, `A163`, `A164`, `A165` | `src/lib/tashjeer/decision/` | Resolver, policy, rule tests, and profile comparison; do not modify for presentation-only requests. |
| Data Model | `A158`, `A160`, `A162`, `A163` | `src/lib/tashjeer/model/v8.ts` | EngineConfig, EngineRule, merge entries, relations, and profile data. |
| Persistence | `A154`, `A168`, `A169` | `src/lib/tashjeer/engine-config-store.ts`, `src/lib/tashjeer/engine-config-history.ts` | Explicit save/import/reset/rollback flows. |
| Tests | `A021`, `A160`, `A168`, `A169` | `tests/engine-studio-*.test.ts`, `tests/decision-*.test.ts` | Policy decisions, deterministic serialization, rule tests, and profile history. |

## A003 — Quran View

- **Route/surface:** `/quran`
- **Status:** `active`
- **Purpose:** قراءة النص العثماني حسب السورة، مع عرض التشجير المحفوظ أو المشتق وروابط التحرير والتصدير.
- **Important child UI IDs:** `A022`, `A180`, `A181`, `A552`, `A553`, `A182`, `A183`, `A184`, `A185`, `A186`, `A187`, `A188`, `A189`, `A554`, `A550`, `A551`
- **Main files:** `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx`, `src/lib/tashjeer/ayah-tashjeer-source.ts`
- **Main components:** `QuranPage`, `AyahTashjeerView`, `TashjeerFigure`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine/data dependencies:** `src/hooks/useAyahTashjeer.ts`, `src/lib/tashjeer/ayah-tashjeer-source.ts`, `src/lib/tashjeer/branch-engine.ts`, `src/lib/tashjeer/classic-tashjeer.ts`
- **Regression tests:** `tests/quran-data.test.ts`, `tests/ayah-tashjeer-source.test.ts`, `tests/figure-render.test.ts`, `tests/global-rule-engine.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A022`, `A180`, `A184`, `A187` | `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx` | Surah search/list, ayah text, and per-ayah tashjeer card. |
| Store | `A183`, `A188` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts` | Saved document and derived global-rule visibility. |
| Engine | `A187` | `src/hooks/useAyahTashjeer.ts`, `src/lib/tashjeer/ayah-tashjeer-source.ts` | Resolve the saved/derived document and render the same figure as the editor. |
| Data Model | `A184`, `A187` | `src/types/tashjeer.ts`, `src/data/quran/index.ts` | Quran ayah keys and persisted tashjeer documents. |
| Tests | `A022`, `A187` | `tests/quran-data.test.ts`, `tests/ayah-tashjeer-source.test.ts`, `tests/figure-render.test.ts` | Data source and renderer parity. |

## A004 — Tracking

- **Route/surface:** `/tracking`
- **Status:** `active`
- **Purpose:** مقارنة ما وجده المحرك بما أضافه أو صححه المحرر، مع أثر القرار وروابط العودة إلى موضع التحرير.
- **Important child UI IDs:** `A023`, `A200`, `A637`, `A638`, `A201`, `A639`, `A640`, `A641`, `A642`, `A202`, `A203`, `A204`, `A205`, `A206`, `A207`, `A208`, `A644`, `A645`, `A646`, `A647`, `A635`, `A636`, `A643`, `A648`, `A649`, `A650`, `A651`, `A652`, `A653`, `A654`, `A655`, `A656`, `A657`, `A658`, `A659`, `A660`, `A661`, `A662`
- **Main files:** `src/app/(dashboard)/tracking/page.tsx`, `src/lib/storage/tracking-store.ts`
- **Main components:** `TrackingPage`, `TrackingRowCard`, `CorrectionTripletView`, `RowDecisionTrace`
- **Stores/persistence owners:** `src/lib/storage/tracking-store.ts`, `src/lib/storage/document-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/decision/api.ts`, `src/lib/tashjeer/decision/editor-bridge.ts`, `src/lib/tashjeer/decision/resolver.ts`
- **Regression tests:** `tests/rule-occurrences-store.test.ts`, `tests/decision-resolver.test.ts`, `tests/decision-editor-bridge.test.ts`, `tests/profile-audit.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A023`, `A200`, `A201`, `A203`, `A204` | `src/app/(dashboard)/tracking/page.tsx` | Category/source filters, summary, row cards, and expanded traces. |
| Store | `A203`, `A204` | `src/lib/storage/tracking-store.ts`, `src/lib/storage/rule-occurrences-store.ts` | Read-only aggregation of editor records and occurrence overrides. |
| Engine | `A206`, `A207` | `src/lib/tashjeer/decision/api.ts`, `src/lib/tashjeer/decision/resolver.ts` | Recomputes decision traces using the same resolver as Studio. |
| Data Model | `A204` | `src/types/tashjeer.ts`, `src/lib/tashjeer/model/v8.ts` | Correction triplets and edit-log events. |
| Tests | `A023`, `A206` | `tests/rule-occurrences-store.test.ts`, `tests/decision-editor-bridge.test.ts` | Tracking derivation and editor/engine classification. |

## A005 — Variant and Rule Index

- **Route/surface:** `/variants`
- **Status:** `active`
- **Purpose:** فهرسة الاختلافات والقواعد العامة مع البحث والتصفية وروابط التحرير.
- **Important child UI IDs:** `A024`, `A220`, `A221`, `A666`, `A667`, `A668`, `A669`, `A670`, `A671`, `A672`, `A673`, `A674`, `A675`, `A676`, `A677`, `A678`, `A679`, `A680`, `A681`, `A682`, `A683`, `A684`, `A2115`, `A2116`, `A2117`, `A2118`, `A222`, `A685`, `A686`, `A687`, `A688`, `A689`, `A663`, `A664`, `A665`, `A223`, `A691`, `A692`, `A693`, `A694`, `A695`, `A696`, `A697`, `A698`, `A699`, `A700`, `A701`, `A702`, `A703`, `A704`, `A705`, `A706`, `A707`, `A708`, `A709`, `A710`, `A711`, `A712`, `A713`, `A714`, `A715`, `A716`, `A717`, `A718`, `A719`, `A720`, `A690`, `A721`, `A722`, `A723`
- **Main files:** `src/app/(dashboard)/variants/page.tsx`, `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`
- **Main components:** `VariantsIndexPage`, `RuleOccurrenceReview`, `GlobalRuleMetaEditor`, `StrengthDegreePicker`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine/data dependencies:** `src/lib/quran-logic/global-rule-engine.ts`, `src/lib/tashjeer/scope.ts`, `src/lib/tashjeer/strength-degrees.ts`
- **Regression tests:** `tests/global-rule-engine.test.ts`, `tests/rule-occurrences-store.test.ts`, `tests/strength-degrees.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A024`, `A220`, `A221`, `A222`, `A223` | `src/app/(dashboard)/variants/page.tsx` | Index filters, result list, and general-rule editor. |
| Store | `A223` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` | Reads local documents and persists general rules. |
| Engine | `A222`, `A223` | `src/lib/quran-logic/global-rule-engine.ts` | Pattern matching and occurrence derivation. |
| Tests | `A024`, `A223` | `tests/global-rule-engine.test.ts`, `tests/rule-occurrences-store.test.ts` | Matching and local override behavior. |

## A006 — Qiraat Catalog

- **Route/surface:** `/qiraat`
- **Status:** `active`
- **Purpose:** استعراض القراءات العشر واختيار قراءة لعرض بياناتها.
- **Important child UI IDs:** `A025`, `A230`, `A231`, `A545`, `A546`, `A547`, `A232`, `A544`, `A548`, `A549`
- **Main files:** `src/app/(dashboard)/qiraat/page.tsx`, `src/data/qiraat-data/qiraat.ts`
- **Main components:** `QiraatPage`, `QiraatTree`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** `src/data/qiraat-data/qiraat.ts`, `src/data/qiraat-data/narrator-profiles.ts`
- **Regression tests:** `tests/catalog-order.test.ts`, `tests/reader-symbols.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A025`, `A230`, `A231` | `src/app/(dashboard)/qiraat/page.tsx`, `src/components/visualization/QiraatTree.tsx` | Search/selection and selected-reading detail. |
| Data Model | `A231` | `src/data/qiraat-data/` | Read-only canonical qiraat data. |
| Tests | `A025`, `A231` | `tests/catalog-order.test.ts`, `tests/reader-symbols.test.ts` | Ordering and symbols. |

## A007 — Readers Catalog

- **Route/surface:** `/readers`
- **Status:** `active`
- **Purpose:** استعراض وإدارة ملفات القراء وإجازاتهم ضمن تنفيذ التخزين الحالي.
- **Important child UI IDs:** `A026`, `A240`, `A242`, `A557`, `A558`, `A243`, `A559`, `A2107`, `A2108`, `A2109`, `A2110`, `A2111`, `A241`, `A560`, `A561`, `A562`, `A555`, `A556`, `A563`, `A564`, `A565`
- **Main files:** `src/app/(dashboard)/readers/page.tsx`, `src/types/index.ts`
- **Main components:** `ReadersPage`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** `src/data/qiraat-data/qiraat.ts`
- **Regression tests:** `tests/catalog-order.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A026`, `A240`, `A241`, `A242` | `src/app/(dashboard)/readers/page.tsx` | Reader form, selectors, and catalog list. |
| Data Model | `A241`, `A242` | `src/types/index.ts` | Reader profile and transmission types. |
| Tests | `A026`, `A242` | `tests/catalog-order.test.ts` | Catalog ordering used by the current implementation. |

## A008 — Scientific Review

- **Route/surface:** `/review`
- **Status:** `active`
- **Purpose:** قائمة المراجعة العلمية المحلية وما يرتبط بها من تحديث حالة أو ملاحظات.
- **Important child UI IDs:** `A027`, `A250`, `A251`, `A568`, `A569`, `A570`, `A571`, `A572`, `A252`, `A253`, `A254`, `A573`, `A574`, `A2123`, `A2124`, `A566`, `A567`, `A575`, `A576`, `A577`, `A578`
- **Main files:** `src/app/(dashboard)/review/page.tsx`
- **Main components:** `ReviewPage`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`
- **Engine/data dependencies:** —
- **Regression tests:** `tests/document-store.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A027`, `A250`, `A251`, `A252` | `src/app/(dashboard)/review/page.tsx` | Review filters and review-item actions. |
| Store | `A252` | `src/lib/storage/document-store.ts` | Current review content is derived from local documents. |
| Tests | `A027`, `A252` | `tests/document-store.test.ts` | Persistence-facing behavior. |

## A009 — Transmission Administration

- **Route/surface:** `/admin`
- **Status:** `active`
- **Purpose:** إدارة الأئمة والرواة والطرق محليا، مع تبويب قديم يحيل إعدادات المحرك إلى الاستوديو.
- **Important child UI IDs:** `A028`, `A260`, `A502`, `A503`, `A261`, `A263`, `A510`, `A511`, `A512`, `A513`, `A514`, `A515`, `A516`, `A517`, `A518`, `A519`, `A520`, `A505`, `A506`, `A507`, `A508`, `A509`, `A521`, `A262`, `A528`, `A2060`, `A500`, `A501`, `A504`, `A522`, `A2091`, `A2092`, `A2093`, `A523`, `A524`, `A525`, `A526`, `A527`, `A529`, `A530`, `A531`, `A532`, `A533`, `A534`, `A535`, `A536`, `A2090`, `A2094`, `A2095`, `A2096`, `A2097`, `A2098`, `A2099`, `A2100`, `A2101`, `A2102`, `A2103`, `A2104`, `A2105`, `A2106`
- **Main files:** `src/app/(dashboard)/admin/page.tsx`, `src/lib/transmissions/catalog.ts`
- **Main components:** `AdminPage`, `TransmissionManager`, `TransmissionEditor`
- **Stores/persistence owners:** `src/lib/transmissions/catalog.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/engine-settings.ts`
- **Regression tests:** `tests/catalog-order.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A028`, `A260`, `A261`, `A262` | `src/app/(dashboard)/admin/page.tsx` | Administration tabs, catalog hierarchy, forms, and reorder interactions. |
| Store | `A261`, `A262` | `src/lib/transmissions/catalog.ts` | Local transmission catalog is the active persistence path. |
| Engine | `A260` | `src/lib/tashjeer/engine-settings.ts` | The legacy engine tab links to Studio; it is not a second settings source. |
| Tests | `A028`, `A261` | `tests/catalog-order.test.ts` | Catalog ordering and peer movement. |

## A010 — Settings

- **Route/surface:** `/settings`
- **Status:** `active`
- **Purpose:** عرض وإدارة إعدادات مساحة العمل الحالية.
- **Important child UI IDs:** `A029`, `A270`, `A271`, `A1665`, `A1666`, `A1667`, `A1668`, `A1669`, `A1670`, `A1671`, `A1672`, `A1673`, `A1674`, `A1675`, `A1676`, `A1677`, `A272`, `A579`, `A580`, `A581`, `A582`, `A583`, `A584`, `A585`, `A586`, `A587`, `A588`, `A589`, `A590`, `A591`, `A592`, `A593`, `A594`, `A2112`, `A2113`, `A2114`, `A595`, `A596`, `A597`
- **Main files:** `src/app/(dashboard)/settings/page.tsx`
- **Main components:** `SettingsPage`, `StrengthDegreesManager`
- **Stores/persistence owners:** `src/lib/tashjeer/strength-degrees.ts`
- **Engine/data dependencies:** `src/data/quran/index.ts`
- **Regression tests:** `tests/strength-degrees.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A029`, `A270`, `A271` | `src/app/(dashboard)/settings/page.tsx`, `src/components/settings/StrengthDegreesManager.tsx` | Settings form and configurable strength-degree manager. |
| Store | `A271` | `src/lib/tashjeer/strength-degrees.ts` | Strength-degree catalog persistence. |
| Tests | `A029`, `A271` | `tests/strength-degrees.test.ts` | Degree catalog constraints. |

## A011 — Statistics

- **Route/surface:** `/statistics`
- **Status:** `active`
- **Purpose:** لوحة قراءة إحصائية للتغطية والمواضع والفئات والرواة والمستندات.
- **Important child UI IDs:** `A030`, `A280`, `A598`, `A599`, `A600`, `A601`, `A602`, `A603`, `A604`, `A605`, `A606`, `A607`, `A608`, `A609`, `A610`, `A611`, `A612`, `A613`, `A614`, `A615`, `A616`, `A617`, `A618`
- **Main files:** `src/app/(dashboard)/statistics/page.tsx`
- **Main components:** `StatisticsPage`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`
- **Engine/data dependencies:** `src/data/quran/index.ts`
- **Regression tests:** `tests/quran-data.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A030`, `A280` | `src/app/(dashboard)/statistics/page.tsx` | Read-only statistical sections and deep links to review. |
| Store | `A280` | `src/lib/storage/document-store.ts` | Counts local saved documents. |
| Data Model | `A280` | `src/data/quran/index.ts` | Quran totals used for coverage. |
| Tests | `A030`, `A280` | `tests/quran-data.test.ts` | Quran data totals. |

## A012 — Public Landing

- **Route/surface:** `/`
- **Status:** `active`
- **Purpose:** صفحة تعريف عامة تعرض قيمة المشروع وروابط الوصول إلى مساحات العمل.
- **Important child UI IDs:** `A031`, `A290`, `A291`, `A1642`, `A1643`, `A1644`, `A1645`, `A1646`, `A1647`, `A1648`, `A1649`, `A1650`, `A1651`, `A1652`, `A1653`, `A1657`, `A1658`, `A1659`, `A1660`, `A1654`, `A1655`, `A1656`, `A1661`, `A1662`, `A728`, `A729`, `A1615`, `A1616`, `A1617`, `A1618`, `A1619`, `A1620`, `A1621`, `A1622`, `A1623`, `A1624`, `A1625`, `A1626`, `A1627`, `A1628`, `A1629`, `A1630`, `A1631`, `A1632`, `A1633`, `A1634`, `A1635`, `A1636`, `A1637`, `A1638`, `A1639`, `A1640`, `A1641`, `A1663`, `A1664`, `A2029`, `A2030`, `A2031`, `A2032`, `A2033`, `A2034`, `A2035`, `A2036`, `A2037`, `A2038`, `A2039`, `A2040`, `A2041`, `A2042`, `A2043`, `A2044`, `A2045`, `A2046`, `A2047`, `A2052`, `A2053`, `A2054`, `A2055`, `A2056`, `A2048`, `A2049`, `A2050`, `A2051`, `A2057`, `A2058`, `A2059`
- **Main files:** `src/app/page.tsx`, `src/components/marketing/PublicHeader.tsx`, `src/components/marketing/PublicFooter.tsx`
- **Main components:** `HomePage`, `PublicHeader`, `PublicFooter`, `LandingStory`, `LandingProof`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** `src/lib/tashjeer/showcase.ts`
- **Regression tests:** `tests/landing-showcase.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A031`, `A290`, `A291` | `src/app/page.tsx`, `src/components/marketing/` | Server-rendered marketing surface and its public navigation. |
| Engine | `A290` | `src/lib/tashjeer/showcase.ts` | Produces the sample visualization displayed on the page. |
| Tests | `A031`, `A290` | `tests/landing-showcase.test.ts` | Showcase model remains backed by real project data. |

## A013 — Local Sign-in

- **Route/surface:** `/login`
- **Status:** `active`
- **Purpose:** واجهة دخول محلية تحفظ شارة الجلسة في المتصفح ولا ترسل بيانات إلى خادم.
- **Important child UI IDs:** `A032`, `A340`, `A341`, `A342`, `A343`, `A344`, `A726`, `A727`
- **Main files:** `src/app/login/page.tsx`, `src/components/layout/SessionBadge.tsx`
- **Main components:** `LoginPage`, `SessionBadge`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** —
- **Regression tests:** —

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A032`, `A340`, `A341`, `A342` | `src/app/login/page.tsx` | Local-only sign-in form and navigation. |
| Persistence | `A344` | `src/app/login/page.tsx` | The submit action writes the local tashjeer-session value only. |

## A014 — UI ID Inspector

- **Route/surface:** `all routes via ?uiInspector=1`
- **Status:** `active`
- **Purpose:** واجهة فحص صريحة تعرض معرفات DOM المسجلة وبيانات السجل الفعلية عند طلب المستخدم، وتبقى مخفية عن المظهر المعتاد.
- **Important child UI IDs:** `A410`, `A730`, `A411`, `A731`, `A412`, `A732`, `A2126`
- **Main files:** `src/components/dev/UIRegistryInspector.tsx`, `src/ui/ui-registry.ts`, `src/ui/feature-registry.ts`
- **Main components:** `UIRegistryInspector`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** —
- **Regression tests:** `tests/ui-registry.test.ts`, `tests/ui-inspector-geometry.test.ts`, `tests/e2e/ui-registry.spec.ts`, `tests/e2e/ui-inspector.spec.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A410`, `A411`, `A412`, `A730`, `A731`, `A732`, `A2126` | `src/components/dev/UIRegistryInspector.tsx`, `src/components/dev/inspector-geometry.ts`, `src/app/layout.tsx` | Off by default. When on, only the hovered element and the pinned element get a badge; badges pin on click and never run the element action. Highlights are a temporary fixed layer that never changes application DOM or styles. |
| Tests | `A410`, `A411`, `A412`, `A731`, `A732`, `A2126` | `tests/ui-registry.test.ts`, `tests/ui-inspector-geometry.test.ts`, `tests/e2e/ui-registry.spec.ts`, `tests/e2e/ui-inspector.spec.ts` | Registry metadata, Inspector geometry, and production browser behavior (hover, pin, red marker, no action on badge click, Escape, teardown, navigation, data immutability) are validated. |

## A015 — Dashboard Workspace Shell

- **Route/surface:** `shared-dashboard`
- **Status:** `active`
- **Purpose:** الغلاف المشترك لمسارات مساحة العمل: التنقل المتجاوب، رابط المصحف، شارة الجلسة، وحاوية التأكيد.
- **Important child UI IDs:** `A310`, `A311`, `A312`, `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A322`, `A323`, `A324`, `A538`, `A539`, `A313`, `A541`, `A542`, `A325`, `A326`, `A327`, `A1988`, `A1989`, `A1990`, `A1991`, `A1992`, `A1993`, `A328`, `A537`, `A540`, `A543`, `A1614`, `A724`, `A725`, `A1994`, `A1995`, `A1996`, `A1997`, `A1998`, `A1999`, `A2000`, `A2001`, `A2002`, `A2003`, `A2004`, `A2005`, `A2006`, `A2007`, `A2008`, `A2009`, `A2010`, `A2011`, `A2012`, `A2013`, `A2014`, `A2015`, `A2016`, `A2017`, `A2018`, `A2019`, `A2020`, `A2021`, `A2022`, `A2023`, `A2024`, `A2025`, `A2026`, `A2027`, `A2028`
- **Main files:** `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx`, `src/components/ui/ConfirmDialogHost.tsx`
- **Main components:** `DashboardLayout`, `SessionBadge`, `ConfirmDialogHost`
- **Stores/persistence owners:** `src/lib/ui/confirm-store.ts`
- **Engine/data dependencies:** —
- **Regression tests:** `tests/confirm-store.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A310`, `A311`, `A312`, `A313`, `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A322`, `A323`, `A324`, `A325`, `A326`, `A327` | `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx` | Shared navigation elements render on multiple dashboard routes and responsive breakpoints. |
| Store | `A327` | `src/lib/ui/confirm-store.ts` | Shared confirmation dialog host; consumers own the business operation. |
| Tests | `A327` | `tests/confirm-store.test.ts` | Confirmation queuing and result behavior. |

## Reading the impact map

The dependency path is **UI ID → owning store/persistence → engine/data model → regression tests**. A UI-only request must remain at its exact UI ID unless the feature behavior proves another layer is necessary; if it does, explain the dependency and keep the change minimal. File/function names are ordinary code references, never UI IDs.
