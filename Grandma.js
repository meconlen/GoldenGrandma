var clicker = 0;
var buyer = 0;
var lump_interval = 0;
var magic_interval = 0;
var ascention_interval = 0;
var dragon_interval = 0;
var debug_level = 0;
var debug_ascention = 0;

var next_purchase_cost = 0;

// https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep

function sleep(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}


function click_golden() {
   Game.shimmers.forEach(
      function(shimmer)
      {
         if(shimmer.type == "golden" && shimmer.wrath == 0) {
            shimmer.pop();
            console.log("Popped golden Cookie");
         }
         if(shimmer.type == "reindeer") {
            shimmer.pop();
            console.log("Popped reindeer");
         }
      }
   )
}

function real_cps_per_buiding(building)
{
   if(Game.Objects[building].amount == 0) {
      return Game.Objects[building].cps(Game.Objects[building]) * Game.globalCpsMult;
   }
   return (Game.Objects[building].storedTotalCps / (Game.Objects[building].amount ))*Game.globalCpsMult;
}

function get_actual_cps(building)
{
   if(building != 'Grandma') {
      return real_cps_per_buiding(building);
   }
   var grandma_count = Game.Objects['Grandma'].amount;
   var synergiesWith={};
   var synergyBoost=0;
   for (var i in Game.GrandmaSynergies) {
      if (Game.Has(Game.GrandmaSynergies[i])) {
         var other=Game.Upgrades[Game.GrandmaSynergies[i]].buildingTie;
         var mult=Game.Objects['Grandma'].amount*0.01*(1/(other.id-1));
         var boost=(other.storedTotalCps*Game.globalCpsMult)-(other.storedTotalCps*Game.globalCpsMult)/(1+mult);
         synergyBoost+=boost;
         if (!synergiesWith[other.plural]) synergiesWith[other.plural]=0;
         synergiesWith[other.plural]+=mult;
      }
   }
   return real_cps_per_buiding(building) + synergyBoost / (grandma_count == 0 ? 1 : grandma_count);
}


function best_building_cps_per_building()
{
   var best_i = 0;
   var best_name = "";
   var best_cps_per_building = 0;
   for (var i in Game.Objects) 
   { 
      // if((i == 'Grandma' && best_building_cps_per_building.last_building != 'Grandma') && Object.keys(Game.buffs).length > 0) { continue; }
      var object_name = Game.Objects[i].name
      // var cps_per_object = Game.Objects[i].cps(Game.Objects[i])/ Game.Objects[i].getPrice()
      var cps_per_object = get_actual_cps(i)/ Game.Objects[i].getPrice()
      if(cps_per_object > best_cps_per_building) {
         best_i = i;
         best_name = object_name;
         best_cps_per_building = cps_per_object;
      }
   }
   best_building_cps_per_building.last_building = i;
   // console.log(best_name, Beautify(Game.Objects[best_name].getPrice()), Math.round(get_actual_cps(best_name)));
   return best_i;
}


// we want to buy the most valuable building however it may take a while to afford it (Game.Objects[i].getPrice() > Game.cookies)
// it will take us time_to_buy = (Game.Objects[i].getPrice() - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50))
// is there another building which we can buy now and would pay for itself in that amount of time
// Game.Objects[i].cps(Game.Objects[i]) * time_to_buy > Game.Objects[i].getPrice()
//
// if so, which one would pay for itself the fastest

function best_building()
{
   // find the most valuable building
   var best_cps_building = best_building_cps_per_building();
   // if we can buy the most valuable building then buy it
   if(Game.Objects[best_cps_building].getPrice() <= Game.cookies) {
      // console.log("buy best building is ", best_cps_building);
      return best_cps_building;
   }

   // if we can't get the most valuable building it will take us this time_to_buy
   var time_to_buy = (Game.Objects[best_cps_building].getPrice() - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50));
 
   // lets see if we can do better by buying something that will pay for itself before time_to_buy
   // turns out I don't think this ever is true
   var fastest_payoff_i = best_cps_building;
   var least_time_to_pay_for = time_to_buy;

   for (var i in Game.Objects) 
   {
      // we want to skip grandmas during buffs 
      if(Game.Objects[i].getPrice() <= Game.cookies) {
         // how many seconds before the cps > getPrice
         var time_to_pay_for = Game.Objects[i].getPrice() / real_cps_per_buiding(i);
         // if it will pay for itself
         if(time_to_pay_for < time_to_buy)
         {
            console.log("We can pay for ", i, " in ", time_to_pay_for, " rather than ", time_to_buy, " seconds for ", fastest_payoff_i);
            if (time_to_pay_for < least_time_to_pay_for) {
               fastest_payoff_i = i;
               least_time_to_pay_for = time_to_pay_for;
            }
         }
      }
   }

   // return the building that pays for itself the fastest or the best_cps_building if none exists 
   return fastest_payoff_i;
}

function get_next_cookie_upgrade()
{
   var max_cookie_upgrade = -1;
   var max_cookie_upgrade_value = 0;
   for (i in Game.UpgradesInStore) {
      if(Game.UpgradesInStore[i].pool == "cookie") {
         upgrade_cps = Game.cookiesPs * (get_cookie_power(Game.UpgradesInStore[i]) / 100);
         upgrade_value = upgrade_cps / Game.UpgradesInStore[i].basePrice;
         if(upgrade_value > max_cookie_upgrade_value) {
            max_cookie_upgrade_value = upgrade_value;
            max_cookie_upgrade = i;
         }
      }
   }
   if(debug)
   return max_cookie_upgrade;
}

function get_next_non_cookie_upgrade()
{
   for(i in Game.UpgradesInStore) {
      if(Game.UpgradesInStore[i].pool != 'cookie' && Game.UpgradesInStore[i].pool != 'toggle') {
         var no_purchase = ['One mind', 'Festive biscuit', 'Ghostly biscuit', 'Lovesick biscuit', "Fool's biscuit", 'Bunny biscuit'];
         if(! no_purchase.includes(Game.UpgradesInStore[i].name)) {
            return i;
         }
      }
   }
   return -1;
}

function log_next_purchase(price, name) {
   var time_to_buy = Math.ceil((price - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50)));

   if(
      name != log_next_purchase.last_name ||
      time_to_buy > log_next_purchase.last_time_to_buy ||
      Math.abs(time_to_buy - log_next_purchase.last_tick_time_to_buy) > 2 ||
      ( time_to_buy / Math.pow(10, Math.floor(Math.log10(time_to_buy))) == Math.round(time_to_buy / Math.pow(10, Math.floor(Math.log10(time_to_buy)))) && 
         time_to_buy > 10 )
      )
   {
      log_next_purchase.last_time_to_buy = time_to_buy;
      log_next_purchase.last_name = name;
      console.log("time to", name, "(", Beautify(price), ") is", Math.ceil(time_to_buy) );
   }
   log_next_purchase.last_tick_time_to_buy = time_to_buy;
}


function get_cookie_power(upgrade)
{
   if(typeof upgrade.power == 'function') {
      return upgrade.power();
   } else {
      return upgrade.power;
   }
}

async function buy_best_building()
{ 
   while(true) {
      var building = best_building();
      var building_cps = get_actual_cps(building);
      var building_price = Game.Objects[building].getPrice();
      var building_value = building_cps / building_price;

      var cookie_upgrade = get_next_cookie_upgrade();
      var cookie_upgrade_cps = 1;
      var cookie_upgrade_price = 1;
      var cookie_upgrade_value = 0; 
      if(cookie_upgrade >= 0) {
         cookie_upgrade_cps = (cookie_upgrade == -1 ? Game.cookiesPs : Game.cookiesPs * (get_cookie_power(Game.UpgradesInStore[cookie_upgrade]) / 100));
         cookie_upgrade_price = Game.UpgradesInStore[cookie_upgrade].getPrice();
         cookie_upgrade_value = cookie_upgrade_cps / cookie_upgrade_price;
      } 
      var non_cookie_upgrade = get_next_non_cookie_upgrade();
      var non_cookie_upgrade_price = -1;
      if(non_cookie_upgrade != -1) {
         non_cookie_upgrade_price = Game.UpgradesInStore[non_cookie_upgrade].getPrice();      
      }

      // if there's a non-cookie upgrade that's cheaper than the best building or other upgrade we buy that
      // if there's not, then it's either the building or the cookie based on value 

      if(debug_level > 0) {
         console.log('non-cookie check', non_cookie_upgrade_price.toExponential(4), 
            building_price.toExponential(4), 
            cookie_upgrade_price.toExponential(4), 
            (non_cookie_upgrade_price < (building_value > cookie_upgrade_value ? building_price : cookie_upgrade_price) ));
      }

      // we want the non-cookie price to be positive 
      // and the non-cookie price to be less than the price of the most valuable other purchase 

      if(non_cookie_upgrade_price > 0 && (non_cookie_upgrade_price < (building_value > cookie_upgrade_value ? building_price : cookie_upgrade_price) )) {
         if(Game.UpgradesInStore[non_cookie_upgrade].canBuy()) {
            console.log("Bought upgrade", Game.UpgradesInStore[non_cookie_upgrade].name);
            Game.UpgradesInStore[non_cookie_upgrade].buy();
            buy_best_building.last_next_purchase = '';
            next_purchase_cost = 0;
            await sleep(50)
            continue;
         } else {
            log_next_purchase(non_cookie_upgrade_price, Game.UpgradesInStore[non_cookie_upgrade].name);
            buy_best_building.last_next_purchase = Game.UpgradesInStore[non_cookie_upgrade].name;
            next_purchase_cost = non_cookie_upgrade_price;
            return;
         }
      }

      // don't buy cookies during buffs as we can't estimate the value properly 
      // unless the last object was a cookie

      if(debug_level > 0) {
         console.log(Object.keys(Game.buffs).length, buy_best_building.last_next_purchase, buy_best_building.last_next_purchase in Game.Upgrades ? Game.Upgrades[buy_best_building.last_next_purchase].pool : "non-upgrade");
         console.log("upgrade values", cookie_upgrade_value, building_value);
      }
      // if(cookie_upgrade != -1 &&  ( Object.keys(Game.buffs).length == 0 || (buy_best_building.last_next_purchase in Game.Upgrades && Game.Upgrades[buy_best_building.last_next_purchase].pool == 'cookie')) ) {
         if(cookie_upgrade_value > building_value) {
            if(Game.UpgradesInStore[cookie_upgrade].canBuy()) {
               console.log("Bought upgrade", Game.UpgradesInStore[cookie_upgrade].name);
               Game.UpgradesInStore[cookie_upgrade].buy();
               buy_best_building.last_next_purchase = '';
               next_purchase_cost = 0;
               await sleep(50)
               continue;
            } else {
               log_next_purchase(cookie_upgrade_price, Game.UpgradesInStore[cookie_upgrade].name);
               buy_best_building.last_next_purchase = Game.UpgradesInStore[cookie_upgrade].name;
               next_purchase_cost = cookie_upgrade_price;
               return;
            }
         }
      // }
      // Nothing left but a building to buy

      if(building_price < Game.cookies) {
         console.log("bought building", building);
         Game.Objects[building].buy(1);
         buy_best_building.last_next_purchase = '';
         next_purchase_cost = 0;
         await sleep(50)
         continue;
      } else {
         log_next_purchase(building_price, building);
         buy_best_building.last_next_purchase = building;
         next_purchase_cost = building_price;
         return;
      }
      break;
   }
}

function click()
{
   Game.ClickCookie();
   click_golden();
}

function buy()
{
   buy_best_building();
}

function spend_lumps()
{
   // Game.Objects['Wizard tower'].levelUp()
   if(Game.lumps > 0) {
      if(Game.Objects['Wizard tower'].level == 0) {
         Game.Objects['Wizard tower'].levelUp();
         return;
      }
      if(Game.Objects['Temple'].level == 0) {
         Game.Objects['Temple'].levelUp();
         return;
      }
      if(Game.Objects['Farm'].level == 0) {
         Game.Objects['Farm'].levelUp();
         return;
      }
      if(Game.Objects['Bank'].level == 0) {
         Game.Objects['Bank'].levelUp();
         return;
      }
      if(Game.Objects['Cursor'].level == 0) {
         Game.Objects['Cursor'].levelUp();
         return;
      }
      if(Game.lumps < 100) {
         return; 
      }
      if(Game.Objects['Cursor'].level < 20) {
         Game.Objects['Cursor'].levelUp();
         return;
      }      
      // only because we really don't play the farm yet
      if(Game.Objects['Farm'].level < 9) {
         Game.Objects['Farm'].levelUp();
         return;
      }
      if(Game.Objects['Farm'].level < 10) {
         Game.Objects['Farm'].levelUp();
         return;
      }
   }

};

function cast_magic()
{
   // do we have a wizard's tower and is it at last level 1
   if(Game.Objects['Wizard tower'].amount > 0 && Game.Objects['Wizard tower'].level > 0)
   {
      var tower = Game.Objects['Wizard tower'];
      if(tower.level > 0) {
         var mini_game = tower.minigame;
         var fate_spell = mini_game.spells['hand of fate']
         var stretch_spell = mini_game.spells['stretch time']
         
         var max_magic = mini_game.magicM;
         var current_magic = mini_game.magic;

         var fate_cost = mini_game.getSpellCost(fate_spell);
         var stretch_Cost = mini_game.getSpellCost(stretch_spell);

         var buffs = Object.keys(Game.buffs).length;
         var cast = 0; 
         if(buffs > 0) {
            for(var i in Game.buffs) {
               if(i != "Frenzy") {
                  if(Game.buffs[i].time > Game.buffs[i].maxTime * 0.8) {
                     cast = 1;
                  }
               }
            }
         }
         // if((current_magic > fate_cost && buffs > 1) || ( current_magic == max_magic && buffs > 0)) {
         //    mini_game.castSpell(fate_spell);
         // }
         if(cast == 1) {
            mini_game.castSpell(fate_spell);
         }

      }
   }
}

// Game.Ascend(true);
// Game.Reincarnate(true);
// Game.prestige == current level 
// Game.HowMuchPrestige(Game.cookiesReset+Game.cookiesEarned) - Game.HowMuchPrestige(Game.cookiesReset) = how much we would get

// Ascend at 213
// we always want to reset when we would earn as many as we have 

// seconds in game is (Date.now() - Game.startDate)/1000
// if the seconds in game is greater than the next building then we aren't getting anywhere


function best_ascention_building_cps_per_building()
{
   var best_i = 0;
   var best_name = "";
   var best_cps_per_building = 0;
   for (var i in Game.Objects) 
   { 
      var object_name = Game.Objects[i].name
      var cps_per_object = get_actual_cps(i)/ Game.Objects[i].getPrice()

      if(cps_per_object > best_cps_per_building) {
         best_i = i;
         best_name = object_name;
         best_cps_per_building = cps_per_object;
      }
   }
   return best_i;
}


// (prestige to gain / (current level + 100)) 

// new_run_time = (current level + to gain + 100) / (current level + 100)  * (cookies this run + item cost) / (cokies this run) * current time
// how long it would take to get the cookies to buy the item (plus everything else) in a new run

// new_run_time < time_to_item 


async function do_ascention()
{
   var current_level = Game.prestige;
   var earned_level = Math.floor(Game.HowMuchPrestige(Game.cookiesReset+Game.cookiesEarned) - Game.HowMuchPrestige(Game.cookiesReset));
   var run_seconds = (Date.now() - Game.startDate)/1000;
// next_purchase_cost


   var current_item_time = (next_purchase_cost - Game.cookies) / (Game.cookiesPs + (Game.computedMouseCps * 1000/50));

   var new_run_time = ( ((current_level + 100) / ( current_level + earned_level + 100))   // a fraction of the time because of new legacy
                    * (run_seconds + current_item_time));

   if(debug_level > 0 || debug_ascention == 1) {
      if(Math.ceil(run_seconds)%10 == 0) {
         console.log("Ascend: new_run_time =", Math.ceil(new_run_time), 
            ", run_seconds =", Math.ceil(run_seconds), 
            ", current_item_time =", Math.ceil(current_item_time),
            ", D =", Math.ceil(new_run_time - run_seconds - current_item_time)
         );
      }
   }
   if(new_run_time < current_item_time && current_item_time > 300) {
      stop_game();
      Game.Ascend(true);
      await sleep(10000);
      Game.Reincarnate(true);
      start_game();
   }   
}

async function upgrade_dragon()
{
   if(Game.Has('A crumbly egg') && Game.dragonLevel < 5) {
      Game.specialTab='dragon';
      Game.ToggleSpecialMenu(1);
      Game.UpgradeDragon();
      Game.ToggleSpecialMenu(0);
   }
   if(Game.dragnLevel == 5) {
      Game.specialTab='dragon';
      Game.ToggleSpecialMenu(1);
      Game.dragonAura=1;
      var highestBuilding=0;
      for (var i in Game.Objects) {if (Game.Objects[i].amount>0) highestBuilding=Game.Objects[i];}
      if(highestBuilding!=0) {
         Game.ObjectsById[highestBuilding.id].sacrifice(1);
      } 
      await sleep(2000);
      Game.ToggleSpecialMenu(0);
      clearInterval(dragon_interval);
   }
}

function start_game()
{
   clicker = setInterval(click, 50);
   buyer = setInterval(buy, 1000);
   lump_interval = setInterval(spend_lumps, 1000);
   magic_interval = setInterval(cast_magic, 1000);
   ascention_interval = setInterval(do_ascention, 1000);
   dragon_interval = setInterval(upgrade_dragon, 1000);
}

function stop_game()
{
   clearInterval(clicker);
   clearInterval(buyer);
   clearInterval(lump_interval);
   clearInterval(magic_interval);
   clearInterval(ascention_interval);
   clearInterval(dragon_interval);
}

function reset_game()
{
   Game.Reset();
}

function debug_game(val)
{
   debug_level = val;
}


