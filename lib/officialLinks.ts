export type OfficialHeritageLink = {
  region: string;
  agency: string;
  url: string;
  kind: string;
};

export const nationalHeritageLinks: OfficialHeritageLink[] = [
  {
    region: '全国',
    agency: '国家文物局',
    url: 'http://www.ncha.gov.cn/',
    kind: '国家文物主管部门'
  },
  {
    region: '全国',
    agency: '文化和旅游部（地方厅局网站汇总）',
    url: 'https://www.mct.gov.cn/',
    kind: '省级主管部门导航'
  },
  {
    region: '全国',
    agency: '中国政府网（文保相关政策检索）',
    url: 'https://www.gov.cn/search/zhengce/?t=zhengce&q=%E5%85%A8%E5%9B%BD%E9%87%8D%E7%82%B9%E6%96%87%E7%89%A9%E4%BF%9D%E6%8A%A4%E5%8D%95%E4%BD%8D',
    kind: '全国重点文物保护单位政策入口'
  }
];

export const provincialHeritageLinks: OfficialHeritageLink[] = [
  { region: '北京市', agency: '北京市文化和旅游局', url: 'http://whlyj.beijing.gov.cn/', kind: '省级官方入口' },
  { region: '天津市', agency: '天津市文化和旅游局', url: 'http://whly.tj.gov.cn/', kind: '省级官方入口' },
  { region: '河北省', agency: '河北省文化和旅游厅', url: 'https://whly.hebei.gov.cn/', kind: '省级官方入口' },
  { region: '山西省', agency: '山西省文化和旅游厅', url: 'https://wlt.shanxi.gov.cn/', kind: '省级官方入口' },
  { region: '内蒙古自治区', agency: '内蒙古自治区文化和旅游厅', url: 'https://wlt.nmg.gov.cn/', kind: '省级官方入口' },
  { region: '辽宁省', agency: '辽宁省文化和旅游厅', url: 'http://whly.ln.gov.cn/', kind: '省级官方入口' },
  { region: '吉林省', agency: '吉林省文化和旅游厅', url: 'http://whhlyt.jl.gov.cn/', kind: '省级官方入口' },
  { region: '黑龙江省', agency: '黑龙江省文化和旅游厅', url: 'http://wlt.hlj.gov.cn/', kind: '省级官方入口' },
  { region: '上海市', agency: '上海市文化和旅游局', url: 'http://whlyj.sh.gov.cn/', kind: '省级官方入口' },
  { region: '江苏省', agency: '江苏省文化和旅游厅', url: 'https://wlt.jiangsu.gov.cn/', kind: '省级官方入口' },
  { region: '浙江省', agency: '浙江省文化广电和旅游厅', url: 'http://ct.zj.gov.cn/', kind: '省级官方入口' },
  { region: '安徽省', agency: '安徽省文化和旅游厅', url: 'https://ct.ah.gov.cn/', kind: '省级官方入口' },
  { region: '福建省', agency: '福建省文化和旅游厅', url: 'http://wlt.fujian.gov.cn/', kind: '省级官方入口' },
  { region: '江西省', agency: '江西省文化和旅游厅', url: 'http://dct.jiangxi.gov.cn/', kind: '省级官方入口' },
  { region: '山东省', agency: '山东省文化和旅游厅', url: 'http://whhly.shandong.gov.cn/', kind: '省级官方入口' },
  { region: '河南省', agency: '河南省文化和旅游厅', url: 'https://hct.henan.gov.cn/', kind: '省级官方入口' },
  { region: '湖北省', agency: '湖北省文化和旅游厅', url: 'https://wlt.hubei.gov.cn/', kind: '省级官方入口' },
  { region: '湖南省', agency: '湖南省文化和旅游厅', url: 'https://whhlyt.hunan.gov.cn/', kind: '省级官方入口' },
  { region: '广东省', agency: '广东省文化和旅游厅', url: 'http://whly.gd.gov.cn/', kind: '省级官方入口' },
  { region: '广西壮族自治区', agency: '广西壮族自治区文化和旅游厅', url: 'http://wlt.gxzf.gov.cn/', kind: '省级官方入口' },
  { region: '海南省', agency: '海南省旅游和文化广电体育厅', url: 'https://lwt.hainan.gov.cn/', kind: '省级官方入口' },
  { region: '重庆市', agency: '重庆市文化和旅游发展委员会', url: 'https://whlyw.cq.gov.cn/', kind: '省级官方入口' },
  { region: '四川省', agency: '四川省文化和旅游厅', url: 'https://wlt.sc.gov.cn/', kind: '省级官方入口' },
  { region: '贵州省', agency: '贵州省文化和旅游厅', url: 'https://whhly.guizhou.gov.cn/', kind: '省级官方入口' },
  { region: '云南省', agency: '云南省文化和旅游厅', url: 'http://dct.yn.gov.cn/', kind: '省级官方入口' },
  { region: '西藏自治区', agency: '西藏自治区文化和旅游厅', url: 'https://wlt.xizang.gov.cn/', kind: '省级官方入口' },
  { region: '陕西省', agency: '陕西省文化和旅游厅', url: 'http://whhlyt.shaanxi.gov.cn/', kind: '省级官方入口' },
  { region: '甘肃省', agency: '甘肃省文化和旅游厅', url: 'http://wlt.gansu.gov.cn/', kind: '省级官方入口' },
  { region: '青海省', agency: '青海省文化和旅游厅', url: 'https://whlyt.qinghai.gov.cn/', kind: '省级官方入口' },
  { region: '宁夏回族自治区', agency: '宁夏回族自治区文化和旅游厅', url: 'http://whhlyt.nx.gov.cn/', kind: '省级官方入口' },
  { region: '新疆维吾尔自治区', agency: '新疆维吾尔自治区文化和旅游厅', url: 'http://wlt.xinjiang.gov.cn/', kind: '省级官方入口' },
  { region: '新疆生产建设兵团', agency: '新疆生产建设兵团文化体育广电和旅游局', url: 'http://wtgl.xjbt.gov.cn/', kind: '兵团官方入口' },
  { region: '香港特别行政区', agency: '香港古物古迹办事处', url: 'https://www.amo.gov.hk/sc/home/index.html', kind: '文物古迹官方入口' },
  { region: '澳门特别行政区', agency: '澳门文化遗产网', url: 'https://www.culturalheritage.mo/sc/', kind: '文化遗产官方入口' },
  { region: '台湾省', agency: '台湾文化资产局', url: 'https://www.boch.gov.tw/', kind: '文化资产官方入口' }
];
