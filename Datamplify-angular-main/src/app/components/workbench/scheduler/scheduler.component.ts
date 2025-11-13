import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/sharedmodule';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { ReactiveFormsModule } from '@angular/forms';
import { WorkbenchService } from '../workbench.service';
import { ToastrService } from 'ngx-toastr';
import { NgxPaginationModule } from 'ngx-pagination';
import { LoaderService } from '../../../shared/services/loader.service';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule, NgbModule, NgSelectModule, ReactiveFormsModule, NgxPaginationModule],
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.scss'
})
export class SchedulerComponent {
  isLoading: boolean = false;
  isKpiLoading: boolean  = false;
  kpiCards: any[] = [
    {
      title: "Total Schedules",
      value: 0,
      valueClass: "text-info",
      icon: "fe fe-clock text-info",
    },
    {
      title: "Active",
      value: 0,
      valueClass: "text-success",
      icon: "fe fe-play text-success",
    },
    // {
    //   title: "Paused",
    //   value: 0,
    //   valueClass: "text-warning",
    //   icon: "fe fe-pause text-warning",
    // },
    {
      title: "Inactive",
      value: 0,
      valueClass: "text-muted",
      icon: "fe fe-alert-circle text-muted",
    },
  ];
  schedules: any[] = [];
  activeTab = 'schedules';
  upcomingRuns: any[] = [];
  showForm: boolean = false;
  sourceList: any[] = [];
  // timezones = Intl.supportedValuesOf('timeZone').map(tz => {
  //   const displayTz = tz === 'Asia/Calcutta' ? 'Asia/Kolkata' : tz;
  //   const offset = new Date().toLocaleTimeString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop();
  //   return { label: `(${offset}) ${displayTz}`, value: displayTz };
  // });
  timezones = [
    { "label": "Africa / Abidjan(GMT)", "value": "Africa/Abidjan" },
    { "label": "Africa / Accra(GMT)", "value": "Africa/Accra" },
    { "label": "Africa / Addis_Ababa(GMT + 3)", "value": "Africa/Addis_Ababa" },
    { "label": "Africa / Algiers(GMT + 1)", "value": "Africa/Algiers" },
    { "label": "Africa / Asmara(GMT + 3)", "value": "Africa/Asmara" },
    { "label": "Africa / Bamako(GMT)", "value": "Africa/Bamako" },
    { "label": "Africa / Bangui(GMT + 1)", "value": "Africa/Bangui" },
    { "label": "Africa / Banjul(GMT)", "value": "Africa/Banjul" },
    { "label": "Africa / Bissau(GMT)", "value": "Africa/Bissau" },
    { "label": "Africa / Blantyre(GMT + 2)", "value": "Africa/Blantyre" },
    { "label": "Africa / Brazzaville(GMT + 1)", "value": "Africa/Brazzaville" },
    { "label": "Africa / Bujumbura(GMT + 2)", "value": "Africa/Bujumbura" },
    { "label": "Africa / Cairo(GMT + 2)", "value": "Africa/Cairo" },
    { "label": "Africa / Casablanca(GMT + 1)", "value": "Africa/Casablanca" },
    { "label": "Africa / Ceuta(GMT + 1)", "value": "Africa/Ceuta" },
    { "label": "Africa / Conakry(GMT)", "value": "Africa/Conakry" },
    { "label": "Africa / Dakar(GMT)", "value": "Africa/Dakar" },
    { "label": "Africa / Dar_es_Salaam(GMT + 3)", "value": "Africa/Dar_es_Salaam" },
    { "label": "Africa / Djibouti(GMT + 3)", "value": "Africa/Djibouti" },
    { "label": "Africa / El_Aaiun(GMT + 1)", "value": "Africa/El_Aaiun" },
    { "label": "Africa / Freetown(GMT)", "value": "Africa/Freetown" },
    { "label": "Africa / Gaborone(GMT + 2)", "value": "Africa/Gaborone" },
    { "label": "Africa / Harare(GMT + 2)", "value": "Africa/Harare" },
    { "label": "Africa / Johannesburg(GMT + 2)", "value": "Africa/Johannesburg" },
    { "label": "Africa / Juba(GMT + 3)", "value": "Africa/Juba" },
    { "label": "Africa / Kampala(GMT + 3)", "value": "Africa/Kampala" },
    { "label": "Africa / Khartoum(GMT + 3)", "value": "Africa/Khartoum" },
    { "label": "Africa / Kigali(GMT + 2)", "value": "Africa/Kigali" },
    { "label": "Africa / Kinshasa(GMT + 1)", "value": "Africa/Kinshasa" },
    { "label": "Africa / Lagos(GMT + 1)", "value": "Africa/Lagos" },
    { "label": "Africa / Libreville(GMT + 1)", "value": "Africa/Libreville" },
    { "label": "Africa / Luanda(GMT + 1)", "value": "Africa/Luanda" },
    { "label": "Africa / Lubumbashi(GMT + 2)", "value": "Africa/Lubumbashi" },
    { "label": "Africa / Lusaka(GMT + 2)", "value": "Africa/Lusaka" },
    { "label": "Africa / Malabo(GMT + 1)", "value": "Africa/Malabo" },
    { "label": "Africa / Maputo(GMT + 2)", "value": "Africa/Maputo" },
    { "label": "Africa / Maseru(GMT + 2)", "value": "Africa/Maseru" },
    { "label": "Africa / Mbabane(GMT + 2)", "value": "Africa/Mbabane" },
    { "label": "Africa / Mogadishu(GMT + 3)", "value": "Africa/Mogadishu" },
    { "label": "Africa / Monrovia(GMT)", "value": "Africa/Monrovia" },
    { "label": "Africa / Nairobi(GMT + 3)", "value": "Africa/Nairobi" },
    { "label": "Africa / Ndjamena(GMT + 1)", "value": "Africa/Ndjamena" },
    { "label": "Africa / Niamey(GMT + 1)", "value": "Africa/Niamey" },
    { "label": "Africa / Nouakchott(GMT)", "value": "Africa/Nouakchott" },
    { "label": "Africa / Ouagadougou(GMT)", "value": "Africa/Ouagadougou" },
    { "label": "Africa / Porto - Novo(GMT + 1)", "value": "Africa/Porto - Novo" },
    { "label": "Africa / Sao_Tome(GMT)", "value": "Africa/Sao_Tome" },
    { "label": "Africa / Tunis(GMT + 1)", "value": "Africa/Tunis" },
    { "label": "Africa / Windhoek(GMT + 2)", "value": "Africa/Windhoek" },
    { "label": "America / Adak(GMT - 10)", "value": "America/Adak" },
    { "label": "America / Anchorage(GMT - 9)", "value": "America/Anchorage" },
    { "label": "America / Anguilla(GMT - 4)", "value": "America/Anguilla" },
    { "label": "America / Antigua(GMT - 4)", "value": "America/Antigua" },
    { "label": "America / Araguaina(GMT - 3)", "value": "America/Araguaina" },
    { "label": "America / Argentina / Buenos_Aires(GMT - 3)", "value": "America/Argentina/Buenos_Aires" },
    { "label": "America / Argentina / Catamarca(GMT - 3)", "value": "America/Argentina/Catamarca" },
    { "label": "America / Argentina / ComodRivadavia(GMT - 3)", "value": "America/Argentina/ComodRivadavia" },
    { "label": "America / Argentina / Cordoba(GMT - 3)", "value": "America/Argentina/Cordoba" },
    { "label": "America / Argentina / Jujuy(GMT - 3)", "value": "America/Argentina/Jujuy" },
    { "label": "America / Argentina / La_Rioja(GMT - 3)", "value": "America/Argentina/La_Rioja" },
    { "label": "America / Argentina / Mendoza(GMT - 3)", "value": "America/Argentina/Mendoza" },
    { "label": "America / Argentina / Rio_Gallegos(GMT - 3)", "value": "America/Argentina/Rio_Gallegos" },
    { "label": "America / Argentina / Salta(GMT - 3)", "value": "America/Argentina/Salta" },
    { "label": "America / Argentina / San_Juan(GMT - 3)", "value": "America/Argentina/San_Juan" },
    { "label": "America / Argentina / San_Luis(GMT - 3)", "value": "America/Argentina/San_Luis" },
    { "label": "America / Argentina / Tucuman(GMT - 3)", "value": "America/Argentina/Tucuman" },
    { "label": "America / Argentina / Ushuaia(GMT - 3)", "value": "America/Argentina/Ushuaia" },
    { "label": "America / Aruba(GMT - 4)", "value": "America/Aruba" },
    { "label": "America / Asuncion(GMT - 4)", "value": "America/Asuncion" },
    { "label": "America / Atikokan(GMT - 5)", "value": "America/Atikokan" },
    { "label": "America / Bahia(GMT - 3)", "value": "America/Bahia" },
    { "label": "America / Bahia_Banderas(GMT - 6)", "value": "America/Bahia_Banderas" },
    { "label": "America / Barbados(GMT - 4)", "value": "America/Barbados" },
    { "label": "America / Belem(GMT - 3)", "value": "America/Belem" },
    { "label": "America / Belize(GMT - 6)", "value": "America/Belize" },
    { "label": "America / Blanc - Sablon(GMT - 4)", "value": "America/Blanc - Sablon" },
    { "label": "America / Boa_Vista(GMT - 4)", "value": "America/Boa_Vista" },
    { "label": "America / Bogota(GMT - 5)", "value": "America/Bogota" },
    { "label": "America / Boise(GMT - 6)", "value": "America/Boise" },
    { "label": "America / Cambridge_Bay(GMT - 7)", "value": "America/Cambridge_Bay" },
    { "label": "America / Campo_Grande(GMT - 4)", "value": "America/Campo_Grande" },
    { "label": "America / Cancun(GMT - 5)", "value": "America/Cancun" },
    { "label": "America / Caracas(GMT - 4)", "value": "America/Caracas" },
    { "label": "America / Cayenne(GMT - 3)", "value": "America/Cayenne" },
    { "label": "America / Cayman(GMT - 5)", "value": "America/Cayman" },
    { "label": "America / Chicago(GMT - 5)", "value": "America/Chicago" },
    { "label": "America / Chihuahua(GMT - 7)", "value": "America/Chihuahua" },
    { "label": "America / Costa_Rica(GMT - 6)", "value": "America/Costa_Rica" },
    { "label": "America / Creston(GMT - 7)", "value": "America/Creston" },
    { "label": "America / Cuiaba(GMT - 4)", "value": "America/Cuiaba" },
    { "label": "America / Curacao(GMT - 4)", "value": "America/Curacao" },
    { "label": "America / Danmarkshavn(GMT - 3)", "value": "America/Danmarkshavn" },
    { "label": "America / Dawson(GMT - 8)", "value": "America/Dawson" },
    { "label": "America / Dawson_Creek(GMT - 7)", "value": "America/Dawson_Creek" },
    { "label": "America / Denver(GMT - 7)", "value": "America/Denver" },
    { "label": "America / Detroit(GMT - 4)", "value": "America/Detroit" },
    { "label": "America / Dominica(GMT - 4)", "value": "America/Dominica" },
    { "label": "America / Edmonton(GMT - 7)", "value": "America/Edmonton" },
    { "label": "America / Eirunepe(GMT - 5)", "value": "America/Eirunepe" },
    { "label": "America / El_Salvador(GMT - 6)", "value": "America/El_Salvador" },
    { "label": "America / Fortaleza(GMT - 3)", "value": "America/Fortaleza" },
    { "label": "America / Glace_Bay(GMT - 4)", "value": "America/Glace_Bay" },
    { "label": "America / Godthab(GMT - 3)", "value": "America/Godthab" },
    { "label": "America / Goose_Bay(GMT - 4)", "value": "America/Goose_Bay" },
    { "label": "America / Grand_Turk(GMT - 5)", "value": "America/Grand_Turk" },
    { "label": "America / Grenada(GMT - 4)", "value": "America/Grenada" },
    { "label": "America / Guadeloupe(GMT - 4)", "value": "America/Guadeloupe" },
    { "label": "America / Guatemala(GMT - 6)", "value": "America/Guatemala" },
    { "label": "America / Guayaquil(GMT - 5)", "value": "America/Guayaquil" },
    { "label": "America / Guyana(GMT - 4)", "value": "America/Guyana" },
    { "label": "America / Houston(GMT - 6)", "value": "America/Houston" },
    { "label": "America / Hermosillo(GMT - 7)", "value": "America/Hermosillo" },
    { "label": "America / Indianapolis(GMT - 5)", "value": "America/Indianapolis" },
    { "label": "America / Jamaica(GMT - 5)", "value": "America/Jamaica" },
    { "label": "America / Juneau(GMT - 8)", "value": "America/Juneau" },
    { "label": "America / Kentucky / Louisville(GMT - 5)", "value": "America/Kentucky/Louisville" },
    { "label": "America / Kentucky / Monticello(GMT - 5)", "value": "America/Kentucky/Monticello" },
    { "label": "America / Kralendijk(GMT - 4)", "value": "America/Kralendijk" },
    { "label": "America / La_Paz(GMT - 4)", "value": "America/La_Paz" },
    { "label": "America / Lima(GMT - 5)", "value": "America/Lima" },
    { "label": "America / Los_Angeles(GMT - 8)", "value": "America/Los_Angeles" },
    { "label": "America / Louisville(GMT - 5)", "value": "America/Louisville" },
    { "label": "America / Lower_Princes(GMT - 4)", "value": "America/Lower_Princes" },
    { "label": "America / Maceio(GMT - 3)", "value": "America/Maceio" },
    { "label": "America / Managua(GMT - 6)", "value": "America/Managua" },
    { "label": "America / Manaus(GMT - 4)", "value": "America/Manaus" },
    { "label": "America / Marigot(GMT - 4)", "value": "America/Marigot" },
    { "label": "America / Martinique(GMT - 4)", "value": "America/Martinique" },
    { "label": "America / Matamoros(GMT - 6)", "value": "America/Matamoros" },
    { "label": "America / Mazatlan(GMT - 7)", "value": "America/Mazatlan" },
    { "label": "America / Mendoza(GMT - 3)", "value": "America/Mendoza" },
    { "label": "America / Menominee(GMT - 6)", "value": "America/Menominee" },
    { "label": "America / Merida(GMT - 6)", "value": "America/Merida" },
    { "label": "America / Metlakatla(GMT - 8)", "value": "America/Metlakatla" },
    { "label": "America / Mexico_City(GMT - 6)", "value": "America/Mexico_City" },
    { "label": "America / Miquelon(GMT - 3)", "value": "America/Miquelon" },
    { "label": "America / Moncton(GMT - 4)", "value": "America/Moncton" },
    { "label": "America / Montevideo(GMT - 3)", "value": "America/Montevideo" },
    { "label": "America / Montreal(GMT - 4)", "value": "America/Montreal" },
    { "label": "America / Montserrat(GMT - 4)", "value": "America/Montserrat" },
    { "label": "America / Nassau(GMT - 5)", "value": "America/Nassau" },
    { "label": "America / New_York(GMT - 5)", "value": "America/New_York" },
    { "label": "America / Nipigon(GMT - 5)", "value": "America/Nipigon" },
    { "label": "America / Nome(GMT - 9)", "value": "America/Nome" },
    { "label": "America / Noronha(GMT - 2)", "value": "America/Noronha" },
    { "label": "America / North_Dakota / Beulah(GMT - 6)", "value": "America/North_Dakota/Beulah" },
    { "label": "America / North_Dakota / Center(GMT - 6)", "value": "America/North_Dakota/Center" },
    { "label": "America / North_Dakota / New_Salem(GMT - 6)", "value": "America/North_Dakota/New_Salem" },
    { "label": "America / Ojinaga(GMT - 7)", "value": "America/Ojinaga" },
    { "label": "America / Panama(GMT - 5)", "value": "America/Panama" },
    { "label": "America / Pangnirtung(GMT - 5)", "value": "America/Pangnirtung" },
    { "label": "America / Paramaribo(GMT - 3)", "value": "America/Paramaribo" },
    { "label": "America / Phoenix(GMT - 7)", "value": "America/Phoenix" },
    { "label": "America / Port_of_Spain(GMT - 4)", "value": "America/Port_of_Spain" },
    { "label": "America / Port - au - Prince(GMT - 5)", "value": "America/Port - au - Prince" },
    { "label": "America / Puerto_Rico(GMT - 4)", "value": "America/Puerto_Rico" },
    { "label": "America / Rainy_River(GMT - 6)", "value": "America/Rainy_River" },
    { "label": "America / Rankin_Inlet(GMT - 6)", "value": "America/Rankin_Inlet" },
    { "label": "America / Recife(GMT - 3)", "value": "America/Recife" },
    { "label": "America / Regina(GMT - 6)", "value": "America/Regina" },
    { "label": "America / Resolute(GMT - 6)", "value": "America/Resolute" },
    { "label": "America / Rio_Branco(GMT - 4)", "value": "America/Rio_Branco" },
    { "label": "America / Santarem(GMT - 3)", "value": "America/Santarem" },
    { "label": "America / Santiago(GMT - 4)", "value": "America/Santiago" },
    { "label": "America / Sao_Paulo(GMT - 3)", "value": "America/Sao_Paulo" },
    { "label": "America / Scoresbysund(GMT - 2)", "value": "America/Scoresbysund" },
    { "label": "America / Shiprock(GMT - 7)", "value": "America/Shiprock" },
    { "label": "America / Sitka(GMT - 8)", "value": "America/Sitka" },
    { "label": "America / St_Barthelemy(GMT - 4)", "value": "America/St_Barthelemy" },
    { "label": "America / St_Johns(GMT - 3: 30)", "value": "America/St_Johns" },
    { "label": "America / St_Kitts(GMT - 4)", "value": "America/St_Kitts" },
    { "label": "America / St_Lucia(GMT - 4)", "value": "America/St_Lucia" },
    { "label": "America / St_Thomas(GMT - 4)", "value": "America/St_Thomas" },
    { "label": "America / St_Vincent(GMT - 4)", "value": "America/St_Vincent" },
    { "label": "America / Tegucigalpa(GMT - 6)", "value": "America/Tegucigalpa" },
    { "label": "America / Thule(GMT - 4)", "value": "America/Thule" },
    { "label": "America / Thunder_Bay(GMT - 5)", "value": "America/Thunder_Bay" },
    { "label": "America / Tijuana(GMT - 8)", "value": "America/Tijuana" },
    { "label": "America / Toronto(GMT - 4)", "value": "America/Toronto" },
    { "label": "America / Tortola(GMT - 4)", "value": "America/Tortola" },
    { "label": "America / Vancouver(GMT - 8)", "value": "America/Vancouver" },
    { "label": "America / Whitehorse(GMT - 8)", "value": "America/Whitehorse" },
    { "label": "America / Winnipeg(GMT - 6)", "value": "America/Winnipeg" },
    { "label": "America / Yakutat(GMT - 8)", "value": "America/Yakutat" },
    { "label": "America / Yellowknife(GMT - 7)", "value": "America/Yellowknife" },
    { "label": "Antarctica / Casey(GMT + 8)", "value": "Antarctica/Casey" },
    { "label": "Antarctica / Davis(GMT + 7)", "value": "Antarctica/Davis" },
    { "label": "Antarctica / DumontDUrville(GMT + 10)", "value": "Antarctica/DumontDUrville" },
    { "label": "Antarctica / Macquarie(GMT + 11)", "value": "Antarctica/Macquarie" },
    { "label": "Antarctica / Palmer(GMT - 3)", "value": "Antarctica/Palmer" },
    { "label": "Antarctica / Rothera(GMT - 3)", "value": "Antarctica/Rothera" },
    { "label": "Antarctica / Syowa(GMT + 3)", "value": "Antarctica/Syowa" },
    { "label": "Antarctica / Troll(GMT + 2)", "value": "Antarctica/Troll" },
    { "label": "Antarctica / Vostok(GMT + 6)", "value": "Antarctica/Vostok" },
    { "label": "Arctic / Longyearbyen(GMT + 1)", "value": "Arctic/Longyearbyen" },
    { "label": "Asia / Aden(GMT + 3)", "value": "Asia/Aden" },
    { "label": "Asia / Almaty(GMT + 6)", "value": "Asia/Almaty" },
    { "label": "Asia / Amman(GMT + 3)", "value": "Asia/Amman" },
    { "label": "Asia / Anadyr(GMT + 12)", "value": "Asia/Anadyr" },
    { "label": "Asia / Aqtau(GMT + 5)", "value": "Asia/Aqtau" },
    { "label": "Asia / Aqtobe(GMT + 5)", "value": "Asia/Aqtobe" },
    { "label": "Asia / Baghdad(GMT + 3)", "value": "Asia/Baghdad" },
    { "label": "Asia / Bahrain(GMT + 3)", "value": "Asia/Bahrain" },
    { "label": "Asia / Baku(GMT + 4)", "value": "Asia/Baku" },
    { "label": "Asia / Bangkok(GMT + 7)", "value": "Asia/Bangkok" },
    { "label": "Asia / Barnaul(GMT + 7)", "value": "Asia/Barnaul" },
    { "label": "Asia / Beirut(GMT + 3)", "value": "Asia/Beirut" },
    { "label": "Asia / Bishkek(GMT + 6)", "value": "Asia/Bishkek" },
    { "label": "Asia / Brunei(GMT + 8)", "value": "Asia/Brunei" },
    { "label": "Asia / Calcutta(GMT + 5: 30)", "value": "Asia/Calcutta" },
    { "label": "Asia / Chita(GMT + 9)", "value": "Asia/Chita" },
    { "label": "Asia / Choibalsan(GMT + 8)", "value": "Asia/Choibalsan" },
    { "label": "Asia / Colombo(GMT + 5: 30)", "value": "Asia/Colombo" },
    { "label": "Asia / Damascus(GMT + 3)", "value": "Asia/Damascus" },
    { "label": "Asia / Dhaka(GMT + 6)", "value": "Asia/Dhaka" },
    { "label": "Asia / Dili(GMT + 9)", "value": "Asia/Dili" },
    { "label": "Asia / Dubai(GMT + 4)", "value": "Asia/Dubai" },
    { "label": "Asia / Dushanbe(GMT + 5)", "value": "Asia/Dushanbe" },
    { "label": "Asia / Famagusta(GMT + 3)", "value": "Asia/Famagusta" },
    { "label": "Asia / Gaza(GMT + 2)", "value": "Asia/Gaza" },
    { "label": "Asia / Ho_Chi_Minh(GMT + 7)", "value": "Asia/Ho_Chi_Minh" },
    { "label": "Asia / Hong_Kong(GMT + 8)", "value": "Asia/Hong_Kong" },
    { "label": "Asia / Hovd(GMT + 7)", "value": "Asia/Hovd" },
    { "label": "Asia / Irkutsk(GMT + 8)", "value": "Asia/Irkutsk" },
    { "label": "Asia / Jakarta(GMT + 7)", "value": "Asia/Jakarta" },
    { "label": "Asia / Jayapura(GMT + 9)", "value": "Asia/Jayapura" },
    { "label": "Asia / Jerusalem(GMT + 3)", "value": "Asia/Jerusalem" },
    { "label": "Asia / Kabul(GMT + 4: 30)", "value": "Asia/Kabul" },
    { "label": "Asia / Kamchatka(GMT + 12)", "value": "Asia/Kamchatka" },
    { "label": "Asia / Karachi(GMT + 5)", "value": "Asia/Karachi" },
    { "label": "Asia / Kathmandu(GMT + 5: 45)", "value": "Asia/Kathmandu" },
    { "label": "Asia / Kolkata(GMT + 5: 30)", "value": "Asia/Kolkata" },
    { "label": "Asia / Krasnoyarsk(GMT + 7)", "value": "Asia/Krasnoyarsk" },
    { "label": "Asia / Kuala_Lumpur(GMT + 8)", "value": "Asia/Kuala_Lumpur" },
    { "label": "Asia / Kuwait(GMT + 3)", "value": "Asia/Kuwait" },
    { "label": "Asia / Macau(GMT + 8)", "value": "Asia/Macau" },
    { "label": "Asia / Magadan(GMT + 11)", "value": "Asia/Magadan" },
    { "label": "Asia / Makassar(GMT + 8)", "value": "Asia/Makassar" },
    { "label": "Asia / Manila(GMT + 8)", "value": "Asia/Manila" },
    { "label": "Asia / Muscat(GMT + 4)", "value": "Asia/Muscat" },
    { "label": "Asia / Nicosia(GMT + 2)", "value": "Asia/Nicosia" },
    { "label": "Asia / Novokuznetsk(GMT + 7)", "value": "Asia/Novokuznetsk" },
    { "label": "Asia / Novosibirsk(GMT + 7)", "value": "Asia/Novosibirsk" },
    { "label": "Asia / Omsk(GMT + 6)", "value": "Asia/Omsk" },
    { "label": "Asia / Oral(GMT + 5)", "value": "Asia/Oral" },
    { "label": "Asia / Phnom_Penh(GMT + 7)", "value": "Asia/Phnom_Penh" },
    { "label": "Asia / Pontianak(GMT + 7)", "value": "Asia/Pontianak" },
    { "label": "Asia / Pyongyang(GMT + 9)", "value": "Asia/Pyongyang" },
    { "label": "Asia / Qatar(GMT + 3)", "value": "Asia/Qatar" },
    { "label": "Asia / Qyzylorda(GMT + 6)", "value": "Asia/Qyzylorda" },
    { "label": "Asia / Riyadh(GMT + 3)", "value": "Asia/Riyadh" },
    { "label": "Asia / Sakhalin(GMT + 11)", "value": "Asia/Sakhalin" },
    { "label": "Asia / Samarkand(GMT + 5)", "value": "Asia/Samarkand" },
    { "label": "Asia / Seoul(GMT + 9)", "value": "Asia/Seoul" },
    { "label": "Asia / Shanghai(GMT + 8)", "value": "Asia/Shanghai" },
    { "label": "Asia / Singapore(GMT + 8)", "value": "Asia/Singapore" },
    { "label": "Asia / Taipei(GMT + 8)", "value": "Asia/Taipei" },
    { "label": "Asia / Tashkent(GMT + 5)", "value": "Asia/Tashkent" },
    { "label": "Asia / Tbilisi(GMT + 4)", "value": "Asia/Tbilisi" },
    { "label": "Asia / Tehran(GMT + 3: 30)", "value": "Asia/Tehran" },
    { "label": "Asia / Tokyo(GMT + 9)", "value": "Asia/Tokyo" },
    { "label": "Asia / Ulaanbaatar(GMT + 8)", "value": "Asia/Ulaanbaatar" },
    { "label": "Asia / Urumqi(GMT + 8)", "value": "Asia/Urumqi" },
    { "label": "Asia / Vientiane(GMT + 7)", "value": "Asia/Vientiane" },
    { "label": "Asia / Vladivostok(GMT + 10)", "value": "Asia/Vladivostok" },
    { "label": "Asia / Yakutsk(GMT + 9)", "value": "Asia/Yakutsk" },
    { "label": "Asia / Yangon(GMT + 6: 30)", "value": "Asia/Yangon" },
    { "label": "Asia / Yekaterinburg(GMT + 5)", "value": "Asia/Yekaterinburg" },
    { "label": "Asia / Yerevan(GMT + 4)", "value": "Asia/Yerevan" },
    { "label": "Atlantic / Azores(GMT - 1)", "value": "Atlantic/Azores" },
    { "label": "Atlantic / Bermuda(GMT - 4)", "value": "Atlantic/Bermuda" },
    { "label": "Atlantic / Canary(GMT + 0)", "value": "Atlantic/Canary" },
    { "label": "Atlantic / Cape_Verde(GMT - 1)", "value": "Atlantic/Cape_Verde" },
    { "label": "Atlantic / Faeroe(GMT + 0)", "value": "Atlantic/Faeroe" },
    { "label": "Atlantic / Florianopolis(GMT - 3)", "value": "Atlantic/Florianopolis" },
    { "label": "Atlantic / Greenwich(GMT + 0)", "value": "Atlantic/Greenwich" },
    { "label": "Atlantic / Reykjavik(GMT + 0)", "value": "Atlantic/Reykjavik" },
    { "label": "Atlantic / South_Georgia(GMT - 2)", "value": "Atlantic/South_Georgia" },
    { "label": "Atlantic / St_Helena(GMT - 2)", "value": "Atlantic/St_Helena" },
    { "label": "Atlantic / Stanley(GMT - 3)", "value": "Atlantic/Stanley" },
    { "label": "Australia / Adelaide(GMT + 9: 30)", "value": "Australia/Adelaide" },
    { "label": "Australia / Brisbane(GMT + 10)", "value": "Australia/Brisbane" },
    { "label": "Australia / Darwin(GMT + 9: 30)", "value": "Australia/Darwin" },
    { "label": "Australia / Hobart(GMT + 10)", "value": "Australia/Hobart" },
    { "label": "Australia / Lindeman(GMT + 10)", "value": "Australia/Lindeman" },
    { "label": "Australia / Melbourne(GMT + 10)", "value": "Australia/Melbourne" },
    { "label": "Australia / Perth(GMT + 8)", "value": "Australia/Perth" },
    { "label": "Australia / Sydney(GMT + 10)", "value": "Australia/Sydney" },
    { "label": "Europe / Amsterdam(GMT + 1)", "value": "Europe/Amsterdam" },
    { "label": "Europe / Andorra(GMT + 1)", "value": "Europe/Andorra" },
    { "label": "Europe / Astrakhan(GMT + 4)", "value": "Europe/Astrakhan" },
    { "label": "Europe / Athens(GMT + 2)", "value": "Europe/Athens" },
    { "label": "Europe / Belgrade(GMT + 1)", "value": "Europe/Belgrade" },
    { "label": "Europe / Berlin(GMT + 1)", "value": "Europe/Berlin" },
    { "label": "Europe / Bratislava(GMT + 1)", "value": "Europe/Bratislava" },
    { "label": "Europe / Brussels(GMT + 1)", "value": "Europe/Brussels" },
    { "label": "Europe / Bucharest(GMT + 2)", "value": "Europe/Bucharest" },
    { "label": "Europe / Budapest(GMT + 1)", "value": "Europe/Budapest" },
    { "label": "Europe / Chisinau(GMT + 2)", "value": "Europe/Chisinau" },
    { "label": "Europe / Copenhagen(GMT + 1)", "value": "Europe/Copenhagen" },
    { "label": "Europe / Dublin(GMT + 0)", "value": "Europe/Dublin" },
    { "label": "Europe / Gibraltar(GMT + 1)", "value": "Europe/Gibraltar" },
    { "label": "Europe / Guernsey(GMT + 0)", "value": "Europe/Guernsey" },
    { "label": "Europe / Helsinki(GMT + 2)", "value": "Europe/Helsinki" },
    { "label": "Europe / Isle_of_Man(GMT + 0)", "value": "Europe/Isle_of_Man" },
    { "label": "Europe / Istanbul(GMT + 3)", "value": "Europe/Istanbul" },
    { "label": "Europe / Jersey(GMT + 0)", "value": "Europe/Jersey" },
    { "label": "Europe / Kaliningrad(GMT + 2)", "value": "Europe/Kaliningrad" },
    { "label": "Europe / Kiev(GMT + 3)", "value": "Europe/Kiev" },
    { "label": "Europe / Lisbon(GMT + 0)", "value": "Europe/Lisbon" },
    { "label": "Europe / Ljubljana(GMT + 1)", "value": "Europe/Ljubljana" },
    { "label": "Europe / London(GMT + 0)", "value": "Europe/London" },
    { "label": "Europe / Luxembourg(GMT + 1)", "value": "Europe/Luxembourg" },
    { "label": "Europe / Madrid(GMT + 1)", "value": "Europe/Madrid" },
    { "label": "Europe / Malta(GMT + 1)", "value": "Europe/Malta" },
    { "label": "Europe / Mariehamn(GMT + 2)", "value": "Europe/Mariehamn" },
    { "label": "Europe / Minsk(GMT + 3)", "value": "Europe/Minsk" },
    { "label": "Europe / Monaco(GMT + 1)", "value": "Europe/Monaco" },
    { "label": "Europe / Moscow(GMT + 3)", "value": "Europe/Moscow" },
    { "label": "Europe / Oslo(GMT + 1)", "value": "Europe/Oslo" },
    { "label": "Europe / Paris(GMT + 1)", "value": "Europe/Paris" },
    { "label": "Europe / Podgorica(GMT + 1)", "value": "Europe/Podgorica" },
    { "label": "Europe / Prague(GMT + 1)", "value": "Europe/Prague" },
    { "label": "Europe / Riga(GMT + 2)", "value": "Europe/Riga" },
    { "label": "Europe / Rome(GMT + 1)", "value": "Europe/Rome" },
    { "label": "Europe / Samara(GMT + 4)", "value": "Europe/Samara" },
    { "label": "Europe / Saratov(GMT + 4)", "value": "Europe/Saratov" },
    { "label": "Europe / Simferopol(GMT + 3)", "value": "Europe/Simferopol" },
    { "label": "Europe / Sofia(GMT + 2)", "value": "Europe/Sofia" },
    { "label": "Europe / Stockholm(GMT + 1)", "value": "Europe/Stockholm" },
    { "label": "Europe / Tallinn(GMT + 2)", "value": "Europe/Tallinn" },
    { "label": "Europe / Tirane(GMT + 1)", "value": "Europe/Tirane" },
    { "label": "Europe / Ulyanovsk(GMT + 4)", "value": "Europe/Ulyanovsk" },
    { "label": "Europe / Vaduz(GMT + 1)", "value": "Europe/Vaduz" },
    { "label": "Europe / Vatican(GMT + 1)", "value": "Europe/Vatican" },
    { "label": "Europe / Vienna(GMT + 1)", "value": "Europe/Vienna" },
    { "label": "Europe / Vilnius(GMT + 2)", "value": "Europe/Vilnius" },
    { "label": "Europe / Volgograd(GMT + 3)", "value": "Europe/Volgograd" },
    { "label": "Europe / Warsaw(GMT + 1)", "value": "Europe/Warsaw" },
    { "label": "Europe / Zagreb(GMT + 1)", "value": "Europe/Zagreb" },
    { "label": "Europe / Zaporozhye(GMT + 3)", "value": "Europe/Zaporozhye" },
    { "label": "Indian / Antananarivo(GMT + 3)", "value": "Indian/Antananarivo" },
    { "label": "Indian / Chagos(GMT + 6)", "value": "Indian/Chagos" },
    { "label": "Indian / Christmas(GMT + 7)", "value": "Indian/Christmas" },
    { "label": "Indian / Cocos(GMT + 6: 30)", "value": "Indian/Cocos" },
    { "label": "Indian / Comoro(GMT + 3)", "value": "Indian/Comoro" },
    { "label": "Indian / Kerguelen(GMT + 5)", "value": "Indian/Kerguelen" },
    { "label": "Indian / Mahe(GMT + 4)", "value": "Indian/Mahe" },
    { "label": "Indian / Maldives(GMT + 5)", "value": "Indian/Maldives" },
    { "label": "Indian / Mauritius(GMT + 4)", "value": "Indian/Mauritius" },
    { "label": "Indian / Reunion(GMT + 4)", "value": "Indian/Reunion" },
    { "label": "Pacific / Apia(GMT + 13)", "value": "Pacific/Apia" },
    { "label": "Pacific / Auckland(GMT + 12)", "value": "Pacific/Auckland" },
    { "label": "Pacific / Bougainville(GMT + 11)", "value": "Pacific/Bougainville" },
    { "label": "Pacific / Chatham(GMT + 13: 45)", "value": "Pacific/Chatham" },
    { "label": "Pacific / Chuuk(GMT + 10)", "value": "Pacific/Chuuk" },
    { "label": "Pacific / Easter(GMT - 6)", "value": "Pacific/Easter" },
    { "label": "Pacific / Efate(GMT + 11)", "value": "Pacific/Efate" },
    { "label": "Pacific / Enderbury(GMT + 12)", "value": "Pacific/Enderbury" },
    { "label": "Pacific / Fakaofo(GMT + 13)", "value": "Pacific/Fakaofo" },
    { "label": "Pacific / Fiji(GMT + 12)", "value": "Pacific/Fiji" },
    { "label": "Pacific / Funafuti(GMT + 12)", "value": "Pacific/Funafuti" },
    { "label": "Pacific / Galapagos(GMT - 6)", "value": "Pacific/Galapagos" },
    { "label": "Pacific / Gambier(GMT - 9)", "value": "Pacific/Gambier" },
    { "label": "Pacific / Guadalcanal(GMT + 11)", "value": "Pacific/Guadalcanal" },
    { "label": "Pacific / Honolulu(GMT - 10)", "value": "Pacific/Honolulu" },
    { "label": "Pacific / Kiritimati(GMT + 14)", "value": "Pacific/Kiritimati" },
    { "label": "Pacific / Kosrae(GMT + 11)", "value": "Pacific/Kosrae" },
    { "label": "Pacific / Kwajalein(GMT + 12)", "value": "Pacific/Kwajalein" },
    { "label": "Pacific / Majuro(GMT + 12)", "value": "Pacific/Majuro" },
    { "label": "Pacific / Marquesas(GMT - 9: 30)", "value": "Pacific/Marquesas" },
    { "label": "Pacific / Nauru(GMT + 12)", "value": "Pacific/Nauru" },
    { "label": "Pacific / Niue(GMT - 11)", "value": "Pacific/Niue" },
    { "label": "Pacific / Norfolk(GMT + 11)", "value": "Pacific/Norfolk" },
    { "label": "Pacific / Noumea(GMT + 11)", "value": "Pacific/Noumea" },
    { "label": "Pacific / Pago_Pago(GMT - 11)", "value": "Pacific/Pago_Pago" },
    { "label": "Pacific / Palau(GMT + 9)", "value": "Pacific/Palau" },
    { "label": "Pacific / Pitcairn(GMT - 8)", "value": "Pacific/Pitcairn" },
    { "label": "Pacific / Pohnpei(GMT + 11)", "value": "Pacific/Pohnpei" },
    { "label": "Pacific / Port_Moresby(GMT + 10)", "value": "Pacific/Port_Moresby" },
    { "label": "Pacific / Rarotonga(GMT - 10)", "value": "Pacific/Rarotonga" },
    { "label": "Pacific / Tahiti(GMT - 10)", "value": "Pacific/Tahiti" },
    { "label": "Pacific / Tarawa(GMT + 12)", "value": "Pacific/Tarawa" },
    { "label": "Pacific / Tongatapu(GMT + 13)", "value": "Pacific/Tongatapu" },
    { "label": "Pacific / Wake(GMT + 12)", "value": "Pacific/Wake" },
    { "label": "Pacific / Wallis(GMT + 12)", "value": "Pacific/Wallis" }
  ];
  custom = {
    repeat: '',
    dateTime: '',
    time: '',
    dayOfMonth: 1,
    month: '1'
  };
  newScheduler = {
    scheduler_type: 'preset',
    timezone: null,
    cron_tab: '',
    source_type: '',
    source_id: '',
    custom: this.custom
  };
  isCronEditorModalOpen = false;
  tempCronExpression: string = '';
  weekDays = [
    { label: 'Sun', value: '0', selected: false },
    { label: 'Mon', value: '1', selected: false },
    { label: 'Tue', value: '2', selected: false },
    { label: 'Wed', value: '3', selected: false },
    { label: 'Thu', value: '4', selected: false },
    { label: 'Fri', value: '5', selected: false },
    { label: 'Sat', value: '6', selected: false }
  ];
  months = [
    { label: 'January', value: '1' },
    { label: 'February', value: '2' },
    { label: 'March', value: '3' },
    { label: 'April', value: '4' },
    { label: 'May', value: '5' },
    { label: 'June', value: '6' },
    { label: 'July', value: '7' },
    { label: 'August', value: '8' },
    { label: 'September', value: '9' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' }
  ];
  cronPreview = '';
  isGenerateBtnDisabled: boolean = true;
  isEditPreview: boolean = false;
  schedulerId: any = '';
  search: string = '';
  stateFilter: string = ''
  page: any = 1;
  pageSize: any = 5;
  totalItems: any;

  constructor(private workbenchService: WorkbenchService, private toasterService: ToastrService, private loaderService: LoaderService) {
  }

  ngOnInit(): void {
    this.loaderService.hide();
    this.getKpisData();
    this.getSchedulerList();
  }

  getSourceList(sourceType: any) {
    if (sourceType === 'flowboard') {
      this.workbenchService.getFlowboardList(1, 1000, '').subscribe({
        next: (data: any) => {
          console.log(data);
          this.sourceList = data.data;
        },
        error: (error: any) => {
          console.log(error);
        }
      });
    } else {
      this.workbenchService.getTaskPlanList(1, 1000, '').subscribe({
        next: (data: any) => {
          console.log(data);
          this.sourceList = data.data;
        },
        error: (error: any) => {
          console.log(error);
        }
      });
    }
  }

  clearFormData() {
    this.showForm = false;
    this.newScheduler = { scheduler_type: 'preset', timezone: null, cron_tab: '', source_type: '', source_id: '', custom: this.custom };
    this.tempCronExpression = '';
  }

  submitForm() {
    console.log('New Scheduler Data:', this.newScheduler);
    let object = {
      scheduler_type: this.newScheduler.scheduler_type,
      timezone: this.newScheduler.timezone,
      cron_tab: this.newScheduler.cron_tab,
      source_type: this.newScheduler.source_type,
      source_id: this.newScheduler.source_id,
      ...(this.newScheduler.scheduler_type === 'custom' && { custom: this.newScheduler.custom })
    }
    if(this.isEditPreview) {
      this.updateScheduler(this.schedulerId, object);
    } else {
      this.saveScheduler(object);
    }
  }

  openCronEditorModal() {
    this.isCronEditorModalOpen = true;
    this.tempCronExpression = this.newScheduler.cron_tab;
    this.custom = { ...this.newScheduler.custom };
  }

  closeCronEditorModal() {
    this.isCronEditorModalOpen = false;
    this.tempCronExpression = '';
    this.custom = { dateTime: '', dayOfMonth: 1, month: '1', repeat: '', time: '' };
  }

  applyCronExpression(){
    this.newScheduler.cron_tab = this.tempCronExpression;
    this.newScheduler.custom = { ...this.custom };
    this.isCronEditorModalOpen = false;
  }

  updateGenerateBtnState() {
    if (!this.custom) {
      this.isGenerateBtnDisabled = true;
      return;
    }

    switch (this.custom.repeat) {
      case '':
        this.isGenerateBtnDisabled = true;
        break;
      case 'once':
        this.isGenerateBtnDisabled = !this.custom.dateTime;
        break;
      case 'daily':
      case 'monthly':
      case 'yearly':
        this.isGenerateBtnDisabled = !this.custom.time;
        break;
      case 'weekly':
        this.isGenerateBtnDisabled = !this.custom.time || !this.weekDays?.some(d => d.selected);
        break;
      default:
        this.isGenerateBtnDisabled = true;
    }
  }

  // generateCron() {
  //   const [hour, minute] = this.custom.time ? this.custom.time.split(':') : ['0', '0'];
  //   let cronExpression = '';
  //   let cronPreview = '';

  //   switch (this.custom.repeat) {
  //     case 'once':
  //       if (!this.custom.dateTime) return;
  //       const date = new Date(this.custom.dateTime);
  //       const sec = date.getSeconds();
  //       const min = date.getMinutes();
  //       const hr = date.getHours();
  //       const day = date.getDate();
  //       const month = date.getMonth() + 1;
  //       cronExpression = `${sec} ${min} ${hr} ${day} ${month} *`;
  //       cronPreview = `Once at ${this.custom.dateTime}`;
  //       break;

  //     case 'daily':
  //       cronExpression = `0 ${minute} ${hour} * * *`;
  //       cronPreview = `Every day at ${this.custom.time}`;
  //       break;

  //     case 'weekly':
  //       const selectedDays = this.weekDays.filter(d => d.selected).map(d => d.value);
  //       if (!selectedDays.length) return;
  //       cronExpression = `0 ${minute} ${hour} * * ${selectedDays.join(',')}`;
  //       cronPreview = `Every week on ${selectedDays.map(v => this.weekDays.find(d => d.value === v)?.label).join(', ')} at ${this.custom.time}`;
  //       break;

  //     case 'monthly':
  //       cronExpression = `0 ${minute} ${hour} ${this.custom.dayOfMonth} * *`;
  //       cronPreview = `Every month on day ${this.custom.dayOfMonth} at ${this.custom.time}`;
  //       break;

  //     case 'yearly':
  //       cronExpression = `0 ${minute} ${hour} ${this.custom.dayOfMonth} ${this.custom.month} *`;
  //       cronPreview = `Every year on ${this.months.find(m => m.value === this.custom.month)?.label} ${this.custom.dayOfMonth} at ${this.custom.time}`;
  //       break;

  //     default:
  //       return;
  //   }

  //   this.tempCronExpression = cronExpression;
  //   this.cronPreview = cronPreview;
  // }

  generateCron() {
    const [hour, minute] = this.custom.time ? this.custom.time.split(':') : ['0', '0'];
    let cronExpression = '';
    let cronPreview = '';

    switch (this.custom.repeat) {
      case 'once':
        if (!this.custom.dateTime) return;
        const date = new Date(this.custom.dateTime);
        const min = date.getMinutes();
        const hr = date.getHours();
        const day = date.getDate();
        const month = date.getMonth() + 1;
        cronExpression = `${min} ${hr} ${day} ${month} *`;
        cronPreview = `Once at ${this.custom.dateTime}`;
        break;

      case 'daily':
        // Every day at given time
        cronExpression = `${minute} ${hour} * * *`;
        cronPreview = `Every day at ${this.custom.time}`;
        break;

      case 'weekly':
        // Every selected day(s) of week at given time
        const selectedDays = this.weekDays.filter(d => d.selected).map(d => d.value);
        if (!selectedDays.length) return;
        cronExpression = `${minute} ${hour} * * ${selectedDays.join(',')}`;
        cronPreview = `Every week on ${selectedDays
          .map(v => this.weekDays.find(d => d.value === v)?.label)
          .join(', ')} at ${this.custom.time}`;
        break;

      case 'monthly':
        // Every month on a specific date at given time
        cronExpression = `${minute} ${hour} ${this.custom.dayOfMonth} * *`;
        cronPreview = `Every month on day ${this.custom.dayOfMonth} at ${this.custom.time}`;
        break;

      case 'yearly':
        // Every year on given date and month
        cronExpression = `${minute} ${hour} ${this.custom.dayOfMonth} ${this.custom.month} *`;
        cronPreview = `Every year on ${this.months.find(m => m.value === this.custom.month)?.label
          } ${this.custom.dayOfMonth} at ${this.custom.time}`;
        break;

      default:
        return;
    }

    this.tempCronExpression = cronExpression;
    this.cronPreview = cronPreview;
  }

  getSchedulerList() {
    this.isLoading = true;
    this.workbenchService.disableLoaderForNextRequest();
    this.workbenchService.getSchedulerList(this.page, this.pageSize, this.search, this.stateFilter).subscribe({
      next: (data: any) => {
        console.log(data);
        this.schedules = data.schedules;
        this.page = data.page_number;
        this.pageSize = data.page_size;
        this.totalItems = data.total_records;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.log(error);
        this.isLoading = false;
      }
    });
  }

  saveScheduler(object: any) {
    this.workbenchService.saveScheduler(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.clearFormData();
        this.getSchedulerList();
        this.getKpisData();
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  editPreviewScheduler(object:any){
    this.isEditPreview = true;
    this.schedulerId = object.id;
    if(this.sourceList.length === 0){
      this.getSourceList(object.source_type);
    }
    this.newScheduler = { 
      scheduler_type: object.schedule_type, 
      timezone: object.timezone, 
      cron_tab: object.schedule_value, 
      source_type: object.source_type, 
      source_id: object.source_id, 
      custom: this.custom 
    };
    this.tempCronExpression = this.newScheduler.cron_tab;
    this.showForm = true;
  }

  updateScheduler(id:any, object: any) {
    this.workbenchService.updateScheduler(id, object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.clearFormData();
        this.getSchedulerList();
        this.getKpisData();
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  deleteScheduler(id: any) {
    this.workbenchService.deleteScheduler(id).subscribe({
      next: (data: any) => {
        console.log(data);
        this.getSchedulerList();
        this.getKpisData();
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getKpisData(){
    this.isKpiLoading = true;
    this.workbenchService.disableLoaderForNextRequest();
    this.workbenchService.getSchedukerKpisData().subscribe({
      next: (data: any) => {
        console.log(data);
        this.kpiCards[0].value = data.total_schedules;
        this.kpiCards[1].value = data.active_schedules;
        this.kpiCards[2].value = data.inactive_schedules;
        this.isKpiLoading = false;
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
        this.isKpiLoading = false;
      }
    });
  }

  getSchedulerById(id: any){
    this.workbenchService.getScheduler(id).subscribe({
      next: (data: any) => {
        console.log(data);
        this.editPreviewScheduler(data);
      },
      error: (error: any) => {
        this.toasterService.error(error.error.message, 'error', { positionClass: 'toast-top-right' });
        console.log(error);
      }
    });
  }

  getUpcommingRuns(){
    this.isLoading = true;
    this.workbenchService.disableLoaderForNextRequest();
    this.workbenchService.getUpcommingRuns(this.page, this.pageSize, this.search).subscribe({
      next: (data: any) => {
        console.log(data);
        this.upcomingRuns = data.data;
        this.page = data.page_number;
        this.pageSize = data.page_size;
        this.totalItems = data.total_records;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.log(error);
        this.isLoading = false;
      }
    });
  }

  onPageSizeChange() {
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (this.page > totalPages) {
      this.page = 1;
    }

    if(this.activeTab === 'schedules'){
      this.getSchedulerList();
    } else{
      this.getUpcommingRuns();
    }
  }

  getSearchData(){
    if(this.activeTab === 'schedules'){
      this.getSchedulerList();
    } else{
      this.getUpcommingRuns();
    }
  }

  changeSchedulerStatus(id: any, status: string){
    let object = {
      schedule_id:id,
      status: status
    }
    this.workbenchService.changeSchedulerStatus(object).subscribe({
      next: (data: any) => {
        console.log(data);
        this.getSchedulerList();
        this.getKpisData();
      },
      error: (error: any) => {
        console.log(error);
      }
    });
  }
}
