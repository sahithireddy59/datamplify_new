import { Injectable } from "@angular/core";
import { NavigationExtras, Router } from "@angular/router";
import { SharedService } from "./shared.service";

@Injectable({ providedIn: 'root' })
export class NavigationService {

    constructor(private router: Router, private sharedService: SharedService) { }

    navigate(commands: any[], extras?: NavigationExtras) {
        const isEmbed = this.sharedService.getEmbedMode();

        // Automatically prefix /embed
        if (isEmbed) {
            commands = ['/embed', ...commands];
        }

        return this.router.navigate(commands, extras);
    }

    getNormalizedUrl(url: string): string {
        return url.replace(/^\/embed/, '');
    }
}