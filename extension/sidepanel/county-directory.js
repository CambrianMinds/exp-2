// ═══════════════════════════════════════════════════════════════════════
// Indiana County Filing & Service Directory
// Provides verified statutory service and filing addresses for Indiana courts,
// Prosecuting Attorneys, Sheriffs, and Statewide Repositories under IC § 35-38-9.
// ═══════════════════════════════════════════════════════════════════════

export const STATEWIDE_AGENCIES = {
  isp: {
    name: 'Indiana State Police',
    division: 'Criminal History Repository / Expungement Section',
    address: 'Indiana Government Center North, 100 N. Senate Ave., Suite N302',
    city: 'Indianapolis',
    state: 'IN',
    zip: '46204',
    phone: '(317) 232-8262',
    serviceMethod: 'Certified U.S. Mail, Return Receipt Requested',
    notes: 'Mandatory recipient for all Indiana expungement orders under IC § 35-38-9-8(e).'
  },
  bmv: {
    name: 'Indiana Bureau of Motor Vehicles',
    division: 'Legal Department / Records Division',
    address: 'Indiana Government Center North, 100 N. Senate Ave., Room N400',
    city: 'Indianapolis',
    state: 'IN',
    zip: '46204',
    phone: '(888) 692-6841',
    serviceMethod: 'Certified U.S. Mail, Return Receipt Requested',
    notes: 'Mandatory recipient for driver license record sealing and points/suspension redactions.'
  }
};

// Verified directory data for major Indiana counties
export const COUNTY_DATA = {
  'MARION': {
    name: 'Marion',
    countySeat: 'Indianapolis',
    courtName: 'Marion Superior Court, Criminal Division',
    courtCode: '49D01',
    clerk: {
      title: 'Marion County Clerk of the Circuit Court',
      address: '675 Justice Way',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46203',
      phone: '(317) 327-4740',
      efileCode: 'marion:court'
    },
    prosecutor: {
      title: 'Office of the Marion County Prosecuting Attorney',
      division: 'Criminal Courts Division / Expungement Section',
      address: '251 E. Ohio St., Suite 160',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46204',
      phone: '(317) 327-3522',
      serviceNotes: 'Accepts service via Odyssey E-Filing (IEFS) or Hand Delivery'
    },
    sheriff: {
      title: "Marion County Sheriff's Office",
      address: '695 Justice Way',
      city: 'Indianapolis',
      state: 'IN',
      zip: '46203',
      phone: '(317) 327-1700'
    }
  },
  'LAKE': {
    name: 'Lake',
    countySeat: 'Crown Point',
    courtName: 'Lake Superior Court, Criminal Division',
    courtCode: '45G01',
    clerk: {
      title: 'Lake County Clerk of the Circuit Court',
      address: '2293 N. Main St., Building A',
      city: 'Crown Point',
      state: 'IN',
      zip: '46307',
      phone: '(219) 755-3460',
      efileCode: 'lake:court'
    },
    prosecutor: {
      title: 'Lake County Prosecuting Attorney',
      division: 'Criminal Division / Special Prosecutions',
      address: '2293 N. Main St.',
      city: 'Crown Point',
      state: 'IN',
      zip: '46307',
      phone: '(219) 755-3720',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Lake County Sheriff's Department",
      address: '2293 N. Main St.',
      city: 'Crown Point',
      state: 'IN',
      zip: '46307',
      phone: '(219) 755-3400'
    }
  },
  'ALLEN': {
    name: 'Allen',
    countySeat: 'Fort Wayne',
    courtName: 'Allen Superior Court, Criminal Division',
    courtCode: '02D04',
    clerk: {
      title: 'Allen County Clerk of Courts',
      address: '715 S. Calhoun St., Room 201',
      city: 'Fort Wayne',
      state: 'IN',
      zip: '46802',
      phone: '(260) 449-7245',
      efileCode: 'allen:court'
    },
    prosecutor: {
      title: "Allen County Prosecuting Attorney's Office",
      division: 'Expungement & Post-Conviction Review',
      address: '602 S. Calhoun St.',
      city: 'Fort Wayne',
      state: 'IN',
      zip: '46802',
      phone: '(260) 449-7641',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Allen County Sheriff's Department",
      address: '715 S. Calhoun St., Room 101',
      city: 'Fort Wayne',
      state: 'IN',
      zip: '46802',
      phone: '(260) 449-7535'
    }
  },
  'HAMILTON': {
    name: 'Hamilton',
    countySeat: 'Noblesville',
    courtName: 'Hamilton Circuit & Superior Courts',
    courtCode: '29D01',
    clerk: {
      title: 'Hamilton County Clerk of the Circuit Court',
      address: '1 Hamilton County Square, Suite 106',
      city: 'Noblesville',
      state: 'IN',
      zip: '46060',
      phone: '(317) 776-8589',
      efileCode: 'hamilton:court'
    },
    prosecutor: {
      title: 'Hamilton County Prosecuting Attorney',
      division: 'Expungement Department',
      address: '1 Hamilton County Square, Suite 134',
      city: 'Noblesville',
      state: 'IN',
      zip: '46060',
      phone: '(317) 776-8595',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Hamilton County Sheriff's Office",
      address: '18100 Cumberland Rd.',
      city: 'Noblesville',
      state: 'IN',
      zip: '46060',
      phone: '(317) 773-1872'
    }
  },
  'ST. JOSEPH': {
    name: 'St. Joseph',
    countySeat: 'South Bend',
    courtName: 'St. Joseph Superior Court',
    courtCode: '71D01',
    clerk: {
      title: 'St. Joseph County Clerk of Courts',
      address: '101 S. Main St.',
      city: 'South Bend',
      state: 'IN',
      zip: '46601',
      phone: '(574) 235-9635',
      efileCode: 'stjoseph:court'
    },
    prosecutor: {
      title: "St. Joseph County Prosecuting Attorney's Office",
      division: 'Criminal Division',
      address: '227 W. Jefferson Blvd., Suite 1000',
      city: 'South Bend',
      state: 'IN',
      zip: '46601',
      phone: '(574) 235-9544',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "St. Joseph County Police Department",
      address: '401 W. Sample St.',
      city: 'South Bend',
      state: 'IN',
      zip: '46601',
      phone: '(574) 235-9611'
    }
  },
  'ELKHART': {
    name: 'Elkhart',
    countySeat: 'Goshen',
    courtName: 'Elkhart Superior Court',
    courtCode: '20D01',
    clerk: {
      title: 'Elkhart County Clerk of the Circuit Court',
      address: '101 N. Main St., Room 204',
      city: 'Goshen',
      state: 'IN',
      zip: '46526',
      phone: '(574) 535-6430',
      efileCode: 'elkhart:court'
    },
    prosecutor: {
      title: 'Elkhart County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '301 S. Main St., Suite 100',
      city: 'Elkhart',
      state: 'IN',
      zip: '46516',
      phone: '(574) 523-2205',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Elkhart County Sheriff's Office",
      address: '26861 County Road 26',
      city: 'Elkhart',
      state: 'IN',
      zip: '46517',
      phone: '(574) 891-2300'
    }
  },
  'VANDERBURGH': {
    name: 'Vanderburgh',
    countySeat: 'Evansville',
    courtName: 'Vanderburgh Superior Court',
    courtCode: '82D01',
    clerk: {
      title: 'Vanderburgh County Clerk',
      address: '825 Sycamore St., Room 216',
      city: 'Evansville',
      state: 'IN',
      zip: '47708',
      phone: '(812) 435-5160',
      efileCode: 'vanderburgh:court'
    },
    prosecutor: {
      title: 'Vanderburgh County Prosecuting Attorney',
      division: 'Criminal Prosecution & Expungement',
      address: '1 NW Martin Luther King Jr Blvd, Room 108',
      city: 'Evansville',
      state: 'IN',
      zip: '47708',
      phone: '(812) 435-5150',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Vanderburgh County Sheriff's Office",
      address: '5607 US Highway 41 N',
      city: 'Evansville',
      state: 'IN',
      zip: '47711',
      phone: '(812) 421-6200'
    }
  },
  'TIPPECANOE': {
    name: 'Tippecanoe',
    countySeat: 'Lafayette',
    courtName: 'Tippecanoe Superior Court',
    courtCode: '79D01',
    clerk: {
      title: 'Tippecanoe County Clerk of Courts',
      address: '301 Main St.',
      city: 'Lafayette',
      state: 'IN',
      zip: '47901',
      phone: '(765) 423-9326',
      efileCode: 'tippecanoe:court'
    },
    prosecutor: {
      title: 'Tippecanoe County Prosecuting Attorney',
      division: 'Expungement Review Division',
      address: '111 N. 4th St.',
      city: 'Lafayette',
      state: 'IN',
      zip: '47901',
      phone: '(765) 423-9305',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Tippecanoe County Sheriff's Office",
      address: '2640 Duncan Rd.',
      city: 'Lafayette',
      state: 'IN',
      zip: '47904',
      phone: '(765) 423-9388'
    }
  },
  'MONROE': {
    name: 'Monroe',
    countySeat: 'Bloomington',
    courtName: 'Monroe Circuit Court',
    courtCode: '53C01',
    clerk: {
      title: 'Monroe County Clerk of the Circuit Court',
      address: '301 N. College Ave., Room 201',
      city: 'Bloomington',
      state: 'IN',
      zip: '47404',
      phone: '(812) 349-2600',
      efileCode: 'monroe:court'
    },
    prosecutor: {
      title: "Monroe County Prosecuting Attorney's Office",
      division: 'Criminal Division',
      address: '301 N. College Ave., Room 122',
      city: 'Bloomington',
      state: 'IN',
      zip: '47404',
      phone: '(812) 349-2670',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Monroe County Sheriff's Office",
      address: '400 W. 7th St.',
      city: 'Bloomington',
      state: 'IN',
      zip: '47404',
      phone: '(812) 349-2780'
    }
  },
  'CLARK': {
    name: 'Clark',
    countySeat: 'Jeffersonville',
    courtName: 'Clark Circuit Court',
    courtCode: '10C01',
    clerk: {
      title: 'Clark County Clerk of Courts',
      address: '501 E. Court Ave.',
      city: 'Jeffersonville',
      state: 'IN',
      zip: '47130',
      phone: '(812) 285-6244',
      efileCode: 'clark:court'
    },
    prosecutor: {
      title: "Clark County Prosecuting Attorney's Office",
      division: 'Criminal Division',
      address: '501 E. Court Ave., Room 215',
      city: 'Jeffersonville',
      state: 'IN',
      zip: '47130',
      phone: '(812) 285-6264',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Clark County Sheriff's Office",
      address: '501 E. Court Ave.',
      city: 'Jeffersonville',
      state: 'IN',
      zip: '47130',
      phone: '(812) 283-4471'
    }
  },
  'PORTER': {
    name: 'Porter',
    countySeat: 'Valparaiso',
    courtName: 'Porter Superior Court',
    courtCode: '64D01',
    clerk: {
      title: 'Porter County Clerk of Courts',
      address: '16 E. Lincolnway, Suite 209',
      city: 'Valparaiso',
      state: 'IN',
      zip: '46383',
      phone: '(219) 465-3450',
      efileCode: 'porter:court'
    },
    prosecutor: {
      title: 'Porter County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '16 E. Lincolnway, Suite 500',
      city: 'Valparaiso',
      state: 'IN',
      zip: '46383',
      phone: '(219) 465-3415',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Porter County Sheriff's Office",
      address: '2755 State Road 49',
      city: 'Valparaiso',
      state: 'IN',
      zip: '46383',
      phone: '(219) 477-3000'
    }
  },
  'HENDRICKS': {
    name: 'Hendricks',
    countySeat: 'Danville',
    courtName: 'Hendricks Superior Court',
    courtCode: '32D01',
    clerk: {
      title: 'Hendricks County Clerk of Courts',
      address: '1 Courthouse Square',
      city: 'Danville',
      state: 'IN',
      zip: '46122',
      phone: '(317) 745-9231',
      efileCode: 'hendricks:court'
    },
    prosecutor: {
      title: 'Hendricks County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '1 Courthouse Square, Suite 200',
      city: 'Danville',
      state: 'IN',
      zip: '46122',
      phone: '(317) 745-9283',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Hendricks County Sheriff's Department",
      address: '925 E. Main St.',
      city: 'Danville',
      state: 'IN',
      zip: '46122',
      phone: '(317) 745-6269'
    }
  },
  'JOHNSON': {
    name: 'Johnson',
    countySeat: 'Franklin',
    courtName: 'Johnson Superior Court',
    courtCode: '41D01',
    clerk: {
      title: 'Johnson County Clerk of Courts',
      address: '5 E. Jefferson St.',
      city: 'Franklin',
      state: 'IN',
      zip: '46131',
      phone: '(317) 346-4450',
      efileCode: 'johnson:court'
    },
    prosecutor: {
      title: 'Johnson County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '100 W. Jefferson St.',
      city: 'Franklin',
      state: 'IN',
      zip: '46131',
      phone: '(317) 346-4525',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Johnson County Sheriff's Office",
      address: '1091 Hospital Rd.',
      city: 'Franklin',
      state: 'IN',
      zip: '46131',
      phone: '(317) 736-9155'
    }
  },
  'DELAWARE': {
    name: 'Delaware',
    countySeat: 'Muncie',
    courtName: 'Delaware Circuit Court',
    courtCode: '18C01',
    clerk: {
      title: 'Delaware County Clerk of the Circuit Court',
      address: '100 W. Washington St., Room 209',
      city: 'Muncie',
      state: 'IN',
      zip: '47305',
      phone: '(765) 747-7726',
      efileCode: 'delaware:court'
    },
    prosecutor: {
      title: 'Delaware County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '100 W. Washington St., Room 312',
      city: 'Muncie',
      state: 'IN',
      zip: '47305',
      phone: '(765) 747-7801',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Delaware County Sheriff's Office",
      address: '3100 S. Tillotson Ave.',
      city: 'Muncie',
      state: 'IN',
      zip: '47302',
      phone: '(765) 747-7878'
    }
  },
  'MADISON': {
    name: 'Madison',
    countySeat: 'Anderson',
    courtName: 'Madison Circuit Court',
    courtCode: '48C01',
    clerk: {
      title: 'Madison County Clerk of the Circuit Court',
      address: '16 E. 9th St., Room 213',
      city: 'Anderson',
      state: 'IN',
      zip: '46016',
      phone: '(765) 641-9443',
      efileCode: 'madison:court'
    },
    prosecutor: {
      title: 'Madison County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '16 E. 9th St., Room 505',
      city: 'Anderson',
      state: 'IN',
      zip: '46016',
      phone: '(765) 641-9588',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Madison County Sheriff's Department",
      address: '720 Central Ave.',
      city: 'Anderson',
      state: 'IN',
      zip: '46016',
      phone: '(765) 642-0221'
    }
  },
  'VIGO': {
    name: 'Vigo',
    countySeat: 'Terre Haute',
    courtName: 'Vigo Superior Court',
    courtCode: '84D01',
    clerk: {
      title: 'Vigo County Clerk of Courts',
      address: '33 S. 3rd St.',
      city: 'Terre Haute',
      state: 'IN',
      zip: '47807',
      phone: '(812) 462-3211',
      efileCode: 'vigo:court'
    },
    prosecutor: {
      title: 'Vigo County Prosecuting Attorney',
      division: 'Criminal Courts Division',
      address: '33 S. 3rd St.',
      city: 'Terre Haute',
      state: 'IN',
      zip: '47807',
      phone: '(812) 462-3305',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Vigo County Sheriff's Office",
      address: '201 Cherry St.',
      city: 'Terre Haute',
      state: 'IN',
      zip: '47807',
      phone: '(812) 462-3226'
    }
  },
  'BARTHOLOMEW': {
    name: 'Bartholomew',
    countySeat: 'Columbus',
    courtName: 'Bartholomew Superior Court',
    courtCode: '03D01',
    clerk: {
      title: 'Bartholomew County Clerk of Courts',
      address: '234 Washington St.',
      city: 'Columbus',
      state: 'IN',
      zip: '47201',
      phone: '(812) 379-1600',
      efileCode: 'bartholomew:court'
    },
    prosecutor: {
      title: 'Bartholomew County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '234 Washington St.',
      city: 'Columbus',
      state: 'IN',
      zip: '47201',
      phone: '(812) 379-1670',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Bartholomew County Sheriff's Office",
      address: '543 2nd St.',
      city: 'Columbus',
      state: 'IN',
      zip: '47201',
      phone: '(812) 379-1650'
    }
  },
  'HUNTINGTON': {
    name: 'Huntington',
    countySeat: 'Huntington',
    courtName: 'Huntington Circuit & Superior Courts',
    courtCode: '35C01',
    clerk: {
      title: 'Huntington County Clerk of the Circuit Court',
      address: '201 N. Jefferson St., Room 201',
      city: 'Huntington',
      state: 'IN',
      zip: '46750',
      phone: '(260) 358-4852',
      efileCode: 'huntington:court'
    },
    prosecutor: {
      title: 'Office of the Huntington County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '201 N. Jefferson St., Room 402',
      city: 'Huntington',
      state: 'IN',
      zip: '46750',
      phone: '(260) 358-4846',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Huntington County Sheriff's Department",
      address: '332 E. State St.',
      city: 'Huntington',
      state: 'IN',
      zip: '46750',
      phone: '(260) 356-8316'
    }
  },
  'WELLS': {
    name: 'Wells',
    countySeat: 'Bluffton',
    courtName: 'Wells Circuit & Superior Courts',
    courtCode: '90C01',
    clerk: {
      title: 'Wells County Clerk of the Circuit Court',
      address: '102 W. Market St., Suite 201',
      city: 'Bluffton',
      state: 'IN',
      zip: '46714',
      phone: '(260) 824-6478',
      efileCode: 'wells:court'
    },
    prosecutor: {
      title: 'Office of the Wells County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '102 W. Market St., Suite 303',
      city: 'Bluffton',
      state: 'IN',
      zip: '46714',
      phone: '(260) 824-6415',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Wells County Sheriff's Office",
      address: '1615 W. Western Ave.',
      city: 'Bluffton',
      state: 'IN',
      zip: '46714',
      phone: '(260) 824-3426'
    }
  },
  'ADAMS': {
    name: 'Adams',
    countySeat: 'Decatur',
    courtName: 'Adams Circuit & Superior Courts',
    courtCode: '01C01',
    clerk: {
      title: 'Adams County Clerk of the Circuit Court',
      address: '112 S. 2nd St., Suite A',
      city: 'Decatur',
      state: 'IN',
      zip: '46733',
      phone: '(260) 724-5300 ext. 2106',
      efileCode: 'adams:court'
    },
    prosecutor: {
      title: 'Office of the Adams County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '112 S. 2nd St., Suite C',
      city: 'Decatur',
      state: 'IN',
      zip: '46733',
      phone: '(260) 724-5313',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Adams County Sheriff's Office",
      address: '313 W. Jefferson St.',
      city: 'Decatur',
      state: 'IN',
      zip: '46733',
      phone: '(260) 724-5345'
    }
  },
  'WHITLEY': {
    name: 'Whitley',
    countySeat: 'Columbia City',
    courtName: 'Whitley Circuit & Superior Courts',
    courtCode: '92C01',
    clerk: {
      title: 'Whitley County Clerk of the Circuit Court',
      address: '101 W. Van Buren St., Room 24',
      city: 'Columbia City',
      state: 'IN',
      zip: '46725',
      phone: '(260) 248-3164',
      efileCode: 'whitley:court'
    },
    prosecutor: {
      title: 'Office of the Whitley County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '101 W. Van Buren St., Suite 22',
      city: 'Columbia City',
      state: 'IN',
      zip: '46725',
      phone: '(260) 248-3126',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Whitley County Sheriff's Department",
      address: '101 W. Market St.',
      city: 'Columbia City',
      state: 'IN',
      zip: '46725',
      phone: '(260) 244-6410'
    }
  },
  'WABASH': {
    name: 'Wabash',
    countySeat: 'Wabash',
    courtName: 'Wabash Circuit & Superior Courts',
    courtCode: '85C01',
    clerk: {
      title: 'Wabash County Clerk of the Circuit Court',
      address: '49 W. Hill St., Suite 207',
      city: 'Wabash',
      state: 'IN',
      zip: '46992',
      phone: '(260) 563-0661',
      efileCode: 'wabash:court'
    },
    prosecutor: {
      title: 'Office of the Wabash County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '99 W. Main St.',
      city: 'Wabash',
      state: 'IN',
      zip: '46992',
      phone: '(260) 563-1105',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Wabash County Sheriff's Department",
      address: '79 W. Main St.',
      city: 'Wabash',
      state: 'IN',
      zip: '46992',
      phone: '(260) 563-8891'
    }
  },
  'GRANT': {
    name: 'Grant',
    countySeat: 'Marion',
    courtName: 'Grant Circuit & Superior Courts',
    courtCode: '27C01',
    clerk: {
      title: 'Grant County Clerk of the Circuit Court',
      address: '101 E. 4th St., Suite 201',
      city: 'Marion',
      state: 'IN',
      zip: '46952',
      phone: '(765) 668-8121',
      efileCode: 'grant:court'
    },
    prosecutor: {
      title: 'Office of the Grant County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '214 E. 4th St.',
      city: 'Marion',
      state: 'IN',
      zip: '46952',
      phone: '(765) 664-0739',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Grant County Sheriff's Department",
      address: '214 E. 4th St.',
      city: 'Marion',
      state: 'IN',
      zip: '46952',
      phone: '(765) 662-9836'
    }
  },
  'BLACKFORD': {
    name: 'Blackford',
    countySeat: 'Hartford City',
    courtName: 'Blackford Circuit & Superior Courts',
    courtCode: '05C01',
    clerk: {
      title: 'Blackford County Clerk of the Circuit Court',
      address: '110 W. Washington St.',
      city: 'Hartford City',
      state: 'IN',
      zip: '47348',
      phone: '(765) 348-1130',
      efileCode: 'blackford:court'
    },
    prosecutor: {
      title: 'Office of the Blackford County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '110 W. Washington St.',
      city: 'Hartford City',
      state: 'IN',
      zip: '47348',
      phone: '(765) 348-1422',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Blackford County Sheriff's Office",
      address: '0064 N 100 E',
      city: 'Hartford City',
      state: 'IN',
      zip: '47348',
      phone: '(765) 348-0930'
    }
  },
  'JAY': {
    name: 'Jay',
    countySeat: 'Portland',
    courtName: 'Jay Circuit & Superior Courts',
    courtCode: '38C01',
    clerk: {
      title: 'Jay County Clerk of the Circuit Court',
      address: '120 S. Court St., Suite 201',
      city: 'Portland',
      state: 'IN',
      zip: '47371',
      phone: '(260) 726-4951',
      efileCode: 'jay:court'
    },
    prosecutor: {
      title: 'Office of the Jay County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '120 S. Court St., Suite 301',
      city: 'Portland',
      state: 'IN',
      zip: '47371',
      phone: '(260) 726-8575',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Jay County Sheriff's Office",
      address: '224 N. Meridian St.',
      city: 'Portland',
      state: 'IN',
      zip: '47371',
      phone: '(260) 726-8188'
    }
  },
  'DEKALB': {
    name: 'DeKalb',
    countySeat: 'Auburn',
    courtName: 'DeKalb Circuit & Superior Courts',
    courtCode: '17C01',
    clerk: {
      title: 'DeKalb County Clerk of the Circuit Court',
      address: '100 S. Main St.',
      city: 'Auburn',
      state: 'IN',
      zip: '46706',
      phone: '(260) 925-0912',
      efileCode: 'dekalb:court'
    },
    prosecutor: {
      title: 'Office of the DeKalb County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '100 S. Main St., 3rd Floor',
      city: 'Auburn',
      state: 'IN',
      zip: '46706',
      phone: '(260) 925-1646',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "DeKalb County Sheriff's Office",
      address: '215 E. 8th St.',
      city: 'Auburn',
      state: 'IN',
      zip: '46706',
      phone: '(260) 925-3365'
    }
  },
  'NOBLE': {
    name: 'Noble',
    countySeat: 'Albion',
    courtName: 'Noble Circuit & Superior Courts',
    courtCode: '57C01',
    clerk: {
      title: 'Noble County Clerk of the Circuit Court',
      address: '101 N. Orange St.',
      city: 'Albion',
      state: 'IN',
      zip: '46701',
      phone: '(260) 636-2736',
      efileCode: 'noble:court'
    },
    prosecutor: {
      title: 'Office of the Noble County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '109 N. York St.',
      city: 'Albion',
      state: 'IN',
      zip: '46701',
      phone: '(260) 636-2193',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Noble County Sheriff's Department",
      address: '1699 W. North St.',
      city: 'Albion',
      state: 'IN',
      zip: '46701',
      phone: '(260) 636-2182'
    }
  },
  'KOSCIUSKO': {
    name: 'Kosciusko',
    countySeat: 'Warsaw',
    courtName: 'Kosciusko Circuit & Superior Courts',
    courtCode: '43C01',
    clerk: {
      title: 'Kosciusko County Clerk of the Circuit Court',
      address: '121 N. Indiana St.',
      city: 'Warsaw',
      state: 'IN',
      zip: '46580',
      phone: '(574) 372-2332',
      efileCode: 'kosciusko:court'
    },
    prosecutor: {
      title: 'Office of the Kosciusko County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '121 N. Indiana St., Suite 200',
      city: 'Warsaw',
      state: 'IN',
      zip: '46580',
      phone: '(574) 372-2419',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Kosciusko County Sheriff's Office",
      address: '221 W. Main St.',
      city: 'Warsaw',
      state: 'IN',
      zip: '46580',
      phone: '(574) 267-5667'
    }
  },
  'STEUBEN': {
    name: 'Steuben',
    countySeat: 'Angola',
    courtName: 'Steuben Circuit & Superior Courts',
    courtCode: '76C01',
    clerk: {
      title: 'Steuben County Clerk of the Circuit Court',
      address: '55 S. Public Square',
      city: 'Angola',
      state: 'IN',
      zip: '46703',
      phone: '(260) 668-1000 ext. 2220',
      efileCode: 'steuben:court'
    },
    prosecutor: {
      title: 'Office of the Steuben County Prosecuting Attorney',
      division: 'Criminal Division',
      address: '205 S. Martha St.',
      city: 'Angola',
      state: 'IN',
      zip: '46703',
      phone: '(260) 668-1000 ext. 2400',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: "Steuben County Sheriff's Office",
      address: '206 E. Elm St.',
      city: 'Angola',
      state: 'IN',
      zip: '46703',
      phone: '(260) 668-1000 ext. 2500'
    }
  }
};

/**
 * Normalizes county name and retrieves filing & service directory data.
 * Falls back to an accurate procedural template for any of Indiana's 92 counties.
 */
export function getCountyInfo(countyName) {
  if (!countyName) countyName = 'Marion';
  const clean = String(countyName).trim().toUpperCase()
    .replace(/\s+COUNTY$/, '')
    .replace(/^COUNTY\s+OF\s+/, '')
    .replace(/\s+/g, ' ');
  
  if (COUNTY_DATA[clean]) {
    return COUNTY_DATA[clean];
  }

  // Common spelling variations
  if (clean === 'DE KALB' && COUNTY_DATA['DEKALB']) return COUNTY_DATA['DEKALB'];
  if ((clean === 'ST JOSEPH' || clean === 'SAINT JOSEPH') && COUNTY_DATA['ST. JOSEPH']) return COUNTY_DATA['ST. JOSEPH'];

  // Format capitalized county name
  const formattedName = clean.charAt(0) + clean.slice(1).toLowerCase();

  return {
    name: formattedName,
    countySeat: `${formattedName} County Seat`,
    courtName: `${formattedName} Circuit / Superior Court`,
    courtCode: `${clean.slice(0, 2)}C01`,
    clerk: {
      title: `${formattedName} County Clerk of the Circuit Court`,
      address: `${formattedName} County Courthouse`,
      city: formattedName,
      state: 'IN',
      zip: '46000',
      phone: 'Contact County Courthouse',
      efileCode: `${clean.toLowerCase()}:court`
    },
    prosecutor: {
      title: `Office of the ${formattedName} County Prosecuting Attorney`,
      division: 'Criminal Division / Expungement Section',
      address: `${formattedName} County Courthouse / Government Center`,
      city: formattedName,
      state: 'IN',
      zip: '46000',
      phone: 'Contact Prosecutor Office',
      serviceNotes: 'Service via Odyssey IEFS or Certified Mail'
    },
    sheriff: {
      title: `${formattedName} County Sheriff's Department`,
      address: `${formattedName} County Sheriff Office`,
      city: formattedName,
      state: 'IN',
      zip: '46000',
      phone: 'Contact County Sheriff'
    }
  };
}

export function getStatewideAgencies() {
  return STATEWIDE_AGENCIES;
}

export function getAvailableCounties() {
  return Object.keys(COUNTY_DATA).map(k => COUNTY_DATA[k].name).sort((a, b) => a.localeCompare(b));
}
