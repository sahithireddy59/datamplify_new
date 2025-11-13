
export function handleThemeUpdate(cssVars: any) {
  const root: any = document.querySelector(':root');
  const keys = Object.keys(cssVars);

  keys.forEach((key) => {
    root.style.setProperty(key, cssVars[key]);
  });
}
// to check the value is hexa or not
const isValidHex = (hexValue: any) =>
  /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hexValue);

const getChunksFromString = (st: any, chunkSize: any) =>
  st.match(new RegExp(`.{${chunkSize}}`, 'g'));
// convert hex value to 256
const convertHexUnitTo256 = (hexStr: any) =>
  parseInt(hexStr.repeat(2 / hexStr.length), 16);
// get alpha value is equla to 1 if there was no value is asigned to alpha in function
const getAlphafloat = (a: any, alpha: any) => {
  if (typeof a !== 'undefined') {
    return a / 255;
  }
  if (typeof alpha != 'number' || alpha < 0 || alpha > 1) {
    return 1;
  }
  return alpha;
};
// convertion of hex code to rgba code
export function hexToRgba(hexValue: any) {
  if (!isValidHex(hexValue)) {
    return hexValue;
  }
  const chunkSize = Math.floor((hexValue.length - 1) / 3);
  const hexArr = getChunksFromString(hexValue.slice(1), chunkSize);
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  return `${r}, ${g} ,${b}`;
}
export function hexToRgba1(hexValue: any) {
  if (!isValidHex(hexValue)) {
    return null;
  }
  const chunkSize = Math.floor((hexValue.length - 1) / 3);
  const hexArr = getChunksFromString(hexValue.slice(1), chunkSize);
  const [r, g, b, ] = hexArr.map(convertHexUnitTo256);
  return `${r+14}, ${g+14}, ${b+14}`;
}
export function hexToRgba2(hexValue: any) {
  if (!isValidHex(hexValue)) {
    return null;
  }
  const chunkSize = Math.floor((hexValue.length - 1) / 3);
  const hexArr = getChunksFromString(hexValue.slice(1), chunkSize);
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  return `${r}, ${g}, ${b}`;
}
export function hexToRgba3(hexValue: any) {
  if (!isValidHex(hexValue)) {
    return null;
  }
  const chunkSize = Math.floor((hexValue.length - 1) / 3);
  const hexArr = getChunksFromString(hexValue.slice(1), chunkSize);
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  return `${r + 5}, ${g + 5}, ${b + 5}`;
}
export function hexToRgba4(hexValue: any) {
  if (!isValidHex(hexValue)) {
    return null;
  }
  const chunkSize = Math.floor((hexValue.length - 1) / 3);
  const hexArr = getChunksFromString(hexValue.slice(1), chunkSize);
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  return `rgb(${r + 5}, ${g + 5}, ${b + 5})`;
}
export function hexToRgba5(hexValue: any) {
  if (!isValidHex(hexValue)) {
    return null;
  }
  const chunkSize = Math.floor((hexValue.length - 1) / 3);
  const hexArr = getChunksFromString(hexValue.slice(1), chunkSize);
  const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
  return `rgba(255,255,255,0.1)`;
}
//primary theme color
export function dynamicLightPrimaryColor(primaryColor: any, color: any) {
  primaryColor.forEach((item: any) => {
    const cssPropName1 = `--primary-rgb`;

    handleThemeUpdate({
      [cssPropName1]: hexToRgba(color),
    });
  });
}

//background theme color
export function dynamicBgTrasnsparentPrimaryColor(
  primaryColor: any,
  color: any
) {
  primaryColor.forEach((item: any) => {
    const cssPropName1 = `--body-bg-rgb`;
    const cssPropName2 = `--body-bg-rgb2`;
    const cssPropName3 = `--light-rgb`;
    const cssPropName4 = `--form-control-bg`;

    handleThemeUpdate({
      [cssPropName1]: hexToRgba(color),
      [cssPropName2]: hexToRgba1(color),
      [cssPropName3]: hexToRgba1(color),
      [cssPropName4]: hexToRgba1(color),


    });
  });
}

export function localStorageBackUp() {
  let html = document.querySelector('html');
  if (localStorage.getItem('data-header-styles') == 'dark') {
    if (html?.setAttribute('data-theme-mode', 'dark')) {
      const light = document.getElementById(
        'switcher-light'
      ) as HTMLInputElement;
      light.checked = true;
    } else {
      if (html?.setAttribute('data-theme-mode', 'light')) {
        const light = document.getElementById(
          'switcher-light'
        ) as HTMLInputElement;
        light.checked = true;
      }
    }
  }

  if (localStorage.getItem('insightapps-dir') == 'rtl') {
    html?.setAttribute("dir", 'rtl');
  }
  if (localStorage.getItem('insightappsdarktheme')) {
    const type: any = localStorage.getItem('insightappsdarktheme');
    html?.setAttribute('data-theme-mode', type);
  }
  if (localStorage.getItem('insightapps-theme-mode')) {
    const type: any = localStorage.getItem('insightapps-theme-mode');
    html?.setAttribute('data-theme-mode', type);
  }
  if (localStorage.getItem('insightapps-nav-mode')) {
    const type: any = localStorage.getItem('insightapps-nav-mode');
    html?.setAttribute('data-nav-layout', type);
    if(type == 'horizontal'){
      html?.setAttribute('data-nav-style', 'menu-click');
      html?.removeAttribute('data-vertical-style')
    }
  }
  if (localStorage.getItem('insightapps-page-mode')) {
    const type: any = localStorage.getItem('insightapps-page-mode');
    html?.setAttribute('data-page-style', type);
  }
  if (localStorage.getItem('insightapps-width-mode')) {
    const type: any = localStorage.getItem('insightapps-width-mode');
    html?.setAttribute('data-width', type);
  }
  if (localStorage.getItem('insightapps-menu-position')) {
    const type: any = localStorage.getItem('insightapps-menu-position');
    html?.setAttribute('data-menu-position', type);
  }
  if (localStorage.getItem('insightapps-menu-mode')) {
    const type: any = localStorage.getItem('insightapps-menu-mode');
    html?.setAttribute('data-menu-styles', type);
  }
  if (localStorage.getItem('insightapps-header-position')) {
    const type: any = localStorage.getItem('insightapps-header-position');
    html?.setAttribute('data-header-position', type);
  }
  if (localStorage.getItem('insightappsHeader')) {
    const type: any = localStorage.getItem('insightappsHeader');
    html?.setAttribute('data-header-styles', type);
  }

  if (localStorage.getItem("insightapps-background-mode-body")) {
    const bodytype: any = localStorage.getItem("insightapps-background-mode-body")
    const darktype: any = localStorage.getItem("insightapps-background-mode-dark")
    const lighttype: any = localStorage.getItem("insightapps-background-mode-light")
    const formtype: any = localStorage.getItem("insightapps-background-mode-formcontrol")
    const inputtype: any = localStorage.getItem("insightapps-background-mode-inputBorder")


    const event: any = localStorage.getItem("insightappsdarktheme");
    html?.style.setProperty('--body-bg-rgb', bodytype);
    html?.style.setProperty('--body-bg-rgb2', darktype);
    html?.style.setProperty('--light-rgb', lighttype);
    html?.style.setProperty('--form-control-bg', formtype);
    html?.style.setProperty('--input-border', inputtype);
    


    html?.setAttribute("data-theme-mode", event);
  }
  if (localStorage.getItem("bodyBgRGB")) {
    const bodytype: any = localStorage.getItem("bodyBgRGB")
    const darktype: any = localStorage.getItem("bodyBgRGB2")
    const lighttype: any = localStorage.getItem("bodylightRGB")
    const formtype: any = localStorage.getItem("insightappslight-background-formcontrol")


    html?.style.setProperty('--body-bg-rgb', bodytype);
    html?.style.setProperty('--body-bg-rgb2', darktype);
    html?.style.setProperty('--light-rgb', lighttype);
    html?.style.setProperty('--form-control-bg', formtype);

    html?.classList.add('dark');
  }
  if (localStorage.getItem("bodylightRGB")) {
    const bodytype: any = localStorage.getItem("bodyBgRGB")
    const darktype: any = localStorage.getItem("bodyBgRGB2")
    const lighttype: any = localStorage.getItem("bodylightRGB")
    const formtype: any = localStorage.getItem("insightappslight-background-formcontrol")
    html?.style.setProperty('--body-bg-rgb', bodytype);
    html?.style.setProperty('--body-bg-rgb2', darktype);
    html?.style.setProperty('--light-rgb', lighttype);
    html?.style.setProperty('--form-control-bg', formtype);
    html?.classList.add('dark');
  }
  if (localStorage.getItem("bodyBgRGB2")) {
    const bodytype: any = localStorage.getItem("bodyBgRGB")
    const darktype: any = localStorage.getItem("bodyBgRGB2")
    const lighttype: any = localStorage.getItem("bodylightRGB")
    const formtype: any = localStorage.getItem("insightappslight-background-formcontrol")
    html?.style.setProperty('--body-bg-rgb', bodytype);
    html?.style.setProperty('--body-bg-rgb2', darktype);
    html?.style.setProperty('--light-rgb', lighttype);
    html?.style.setProperty('--form-control-bg', formtype);
    html?.classList.add('dark');
  }
  if (localStorage.getItem("insightappsMenu")) {
    const type1: any = localStorage.getItem("insightappsMenu");
    html?.setAttribute("data-nav-style", type1);
    const type: any = localStorage.getItem('insightappsMenu-toggled');
    html?.setAttribute('data-toggled', type);
  }
 
  if (localStorage.getItem('insightappsverticalstyles')) {
    const type1: any = localStorage.getItem('insightappsverticalstyles');
    document.querySelector('html')?.setAttribute('data-vertical-style', type1);
    const type: any = localStorage.getItem('insightappsverticalstyles');
    document.querySelector('html')?.setAttribute('data-toggled', type);

    if (localStorage.getItem('data-vertical-style') == type1) {
      html?.setAttribute('data-toggled', type);
    } else {
      const type1: any = localStorage.getItem('insightappsverticalstyles-toggled');
      document.querySelector('html')?.setAttribute('data-toggled', document.querySelector(".slide.open")?.classList.contains("has-sub") ? type1 : 'double-menu-close');

    }
  }
  if (localStorage.getItem("insightapps-image")) {
    const type: any = localStorage.getItem("insightapps-image");
    html?.setAttribute('data-bg-img', type);
  }

  if (localStorage.getItem("insightapps-primary-mode")) { 
    const type: any = localStorage.getItem("insightapps-primary-mode");
    html?.style.setProperty('--primary-rgb', type);
  }

  if (localStorage.getItem("insightappslight-primary-color")) {
    const type: any = localStorage.getItem("insightappslight-primary-color");
    html?.style.setProperty('--primary-rgb', type);
  }
  if (localStorage.getItem("insightappslight-primary-color1")) {
    const type: any = localStorage.getItem("insightappslight-primary-color1");
    // html?.style.setProperty('--primary-rgb', type);
    html?.style.setProperty('--primary', type);
  }
  if (localStorage.getItem('textColor')) {
    const textColor: any = localStorage.getItem('textColor');
    html?.style.setProperty('--default-text-color', textColor);
  }
}