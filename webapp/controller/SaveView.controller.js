sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageBox"],
  function (Controller) {
    "use strict";

    return Controller.extend("rfinterfacereceptionv2.controller.SaveView", {
      onInit: function () {
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("RouteSaveView")
          .attachPatternMatched(this.onRouteMatched, this);
      },

      onRouteMatched: function () {
        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("Cancel");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_6").setText(sText);

        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("Saves");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_7").setText(sText);

        this.getView()
          .byId("_IDGenInput_9_t")
          .setValue(sessionStorage.storeOrder);

        let payloadList = globalThis.finalPayloadList;

        // Se non c'è nel globalThis, prova nel sessionStorage
        if (!payloadList || payloadList.length === 0) {
          const stored = sessionStorage.getItem("finalPayloadList");
          if (stored) {
            payloadList = JSON.parse(stored);
          }
        }

        // Se ancora non trovi nulla, torna alla prima pagina
        if (!payloadList || payloadList.length === 0) {
          const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("RouteFirstView");
          return;
        }

        // Filtra ogni to_MaterialDocumentItem per rimuovere voci senza Material
        payloadList.forEach((payload) => {
          payload.to_MaterialDocumentItem =
            payload.to_MaterialDocumentItem.filter((item) => !!item.Material);
        });

        // Rimuovi i payload completamente vuoti
        const cleanedPayloadList = payloadList.filter(
          (payload) => payload.to_MaterialDocumentItem.length > 0
        );

        // Se non è rimasto nulla dopo il filtro, vai alla prima pagina
        if (cleanedPayloadList.length === 0) {
          this.getRouter().navTo("RouteFirstView");
          return;
        }

        // Salva in variabili globali e sessionStorage
        globalThis.finalPayloadList = cleanedPayloadList;
        sessionStorage.setItem(
          "finalPayloadList",
          JSON.stringify(cleanedPayloadList)
        );

        // Ora puoi continuare con il payload pulito
        this._payloadList = cleanedPayloadList;

        const grouped = {};
        cleanedPayloadList.forEach((payload) => {
          payload.to_MaterialDocumentItem.forEach((item) => {
            const key = item.Material + "_" + item.EntryUnit;

            if (!grouped[key]) {
              grouped[key] = {
                article: item.Material,
                qty: parseFloat(item.QuantityInEntryUnit),
                unit: item.EntryUnit,
                pal: 1,
              };
            } else {
              grouped[key].qty += parseFloat(item.QuantityInEntryUnit);
              grouped[key].pal += 1;
            }
          });
        });

        // Converti in array e formatta qty/pal come stringhe
        const aggregatedItems = Object.values(grouped).map((item) => ({
          ...item,
          qty: item.qty.toString(),
          pal: item.pal.toString(),
        }));

        // Imposta il modello JSON per la vista
        const oJSONModel = new sap.ui.model.json.JSONModel({
          items: aggregatedItems,
        });

        this.getView().setModel(oJSONModel, "model");
      },

      onPressReject: function () {
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("RecCanc");

        let that = this;

        sap.m.MessageBox.confirm(sText, {
          actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
          emphasizedAction: sap.m.MessageBox.Action.NO,
          onClose: function (oAction) {
            if (oAction === sap.m.MessageBox.Action.YES) {
              globalThis.readData = {};

              globalThis.finalPayload = {
                PostingDate: "",
                GoodsMovementCode: "",
                to_MaterialDocumentItem: [],
              };

              globalThis.finalPayloadList = [];
              sessionStorage.clear("finalPayload");
              sessionStorage.clear("finalPayloadList");

              const oEmptyModel = new sap.ui.model.json.JSONModel({
                items: [
                  {
                    article: "",
                    qty: "",
                    unit: "",
                    pal: "",
                  },
                ],
              });

              that.getView().setModel(oEmptyModel, "model");

              const oRouter = sap.ui.core.UIComponent.getRouterFor(that);
              oRouter.navTo("RouteFirstView");
            }
          },
        });
      },
      onSave: function () {
        let payloadList = globalThis.finalPayloadList;

        // Se non c'è nel globalThis, prova nel sessionStorage
        if (!payloadList || payloadList.length === 0) {
          const stored = sessionStorage.getItem("finalPayloadList");
          if (stored) {
            payloadList = JSON.parse(stored);
          }
        }

        // ✅ Controllo se la variabile globale è valorizzata
        if (!payloadList || payloadList.length === 0) {
          sap.m.MessageBox.error(
            "Nessun dato da salvare. Aggiungi almeno una riga prima di procedere.",
            { title: "Errore di Salvataggio" }
          );
          return;
        }

        const that = this;
        const oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/",
          true
        );

        // Merge dei payload per PostingDate e GoodsMovementCode
        const mergedMap = new Map();
        payloadList.forEach((item) => {
          const key = `${item.PostingDate}_${item.GoodsMovementCode}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, {
              PostingDate: item.PostingDate,
              GoodsMovementCode: item.GoodsMovementCode,
              to_MaterialDocumentItem: [...item.to_MaterialDocumentItem],
            });
          } else {
            const existing = mergedMap.get(key);
            existing.to_MaterialDocumentItem.push(
              ...item.to_MaterialDocumentItem
            );
          }
        });

        const mergedPayloadList = Array.from(mergedMap.values());
        const resultsSummary = [];
        const i18n = that.getView().getModel("i18n").getResourceBundle();

        mergedPayloadList.forEach((originalPayload) => {
          // STEP 0: Create receipt (101) in MM
          _createReceipt101(originalPayload, oModel, that)
            .then(async (docNumber101) => {
              resultsSummary.push({
                step: i18n.getText("step.receipt101"),
                id: docNumber101.docNumber,
                year: docNumber101.docNumberYear,
              });

              // STEP 1: Get packing instructions
              //const packingData = await _getPackingInstructions(
              //  originalPayload,
              //  oModel
              //);
              return {
                docNumber101,
                originalPayload,
              };
            })
            .then(async ({ docNumber101, originalPayload }) => {
              // STEP 1.5: Get packing info extra
              const packingData = await _getExtra(docNumber101);
              return { docNumber101, originalPayload, packingData };
            })
            .then(async ({ docNumber101, originalPayload, packingData }) => {
              // STEP 2: Create HU
              const huData = await _createHU(
                packingData,
                originalPayload,
                oModel
              );
              resultsSummary.push({
                step: i18n.getText("step.hu.create"),
                id: huData.huID,
              });
              return { docNumber101, originalPayload, packingData, huData };
            })
            .then(
              async ({
                docNumber101,
                originalPayload,
                packingData,
                huData,
              }) => {
                // STEP 3: Move HU to eWM
                const moveResult = await _moveHUtoEWM(
                  packingData,
                  huData,
                  oModel
                );
                resultsSummary.push({
                  step: i18n.getText("step.hu.move"),
                  id: moveResult.moveID,
                });
                return {
                  docNumber101,
                  originalPayload,
                  packingData,
                  huData,
                  moveResult,
                };
              }
            )
            .then(
              async ({
                docNumber101,
                originalPayload,
                packingData,
                huData,
                moveResult,
              }) => {
                // STEP 4: Create eWM task
                const taskResult = await _createEWMTask(
                  huData,
                  moveResult,
                  oModel
                );
                resultsSummary.push({
                  step: i18n.getText("step.task.create"),
                  id: taskResult.taskID,
                });
                return {
                  docNumber101,
                  originalPayload,
                  packingData,
                  huData,
                  moveResult,
                  taskResult,
                };
              }
            )
            .then(() => {
              // Tutto completato con successo → popup riepilogativo
              _onSaveSuccess(that, resultsSummary);
            })
            .catch((error) => {
              // Qualsiasi errore → popup di errore singolo
              _onSaveError(error, that);
            });
        });

        // ============ STEP 0: Create Receipt 101 ============
        function _createReceipt101(payload, oModel, context) {
          return new Promise((resolve, reject) => {
            const receipt101 = JSON.parse(JSON.stringify(payload));
            receipt101.to_MaterialDocumentItem.forEach((item) => {
              item.GoodsMovementType = "101";
              item.GoodsMovementRefDocType = "B";
              item.ManufactureDate = receipt101.PostingDate;
            });

            oModel.create("/A_MaterialDocumentHeader", receipt101, {
              success: function (data) {
                const docNumber = data.MaterialDocument;
                const docNumberYear = data.MaterialDocumentYear;
                resolve({ docNumber, docNumberYear });
              },
              error: function (err) {
                let errorMsg =
                  "Errore durante la creazione del ricevimento 101.";
                try {
                  const oResponse = JSON.parse(err.responseText);
                  if (oResponse?.error?.message?.value) {
                    errorMsg = oResponse.error.message.value;
                  }
                } catch (e) {}
                reject(new Error(errorMsg));
              },
            });
          });
        }

        // ============ STEP 1: Get Packing Instructions ============
        //function _getPackingInstructions(payload) {
        //  return new Promise((resolve, reject) => {
        //    const firstMaterial = payload.to_MaterialDocumentItem[0];
        //    const material = firstMaterial.Material;
        //    const quantity =
        //      firstMaterial.QuantityInEntryUnit ||
        //      firstMaterial.QuantityInBaseUnitOfMeasure;
        //    const unit =
        //      firstMaterial.EntryUnit || firstMaterial.BaseUnitOfMeasure;
        //    const batch = firstMaterial.Batch || "";
        //
        //    // Costruisci l'URL con filtro e expand
        //    const url = `/sap/opu/odata/sap/API_PACKINGINSTRUCTION/PackingInstructionComponent?$filter=Material eq '${material}'&$expand=to_PackingInstructionHeader`;
        //
        //    const xhr = new XMLHttpRequest();
        //    xhr.withCredentials = true; // usa la sessione utente SAP
        //
        //    xhr.onreadystatechange = function () {
        //      if (xhr.readyState === 4) {
        //        if (xhr.status >= 200 && xhr.status < 300) {
        //          try {
        //            const response = JSON.parse(xhr.responseText);
        //            const csrfToken = xhr.getResponseHeader("x-csrf-token");
        //
        //            // ✅ Controlliamo se esistono risultati
        //            const results = response.d?.results || [];
        //            if (results.length > 0) {
        //              const packingComponent = results[0];
        //
        //              // Estrai dati principali
        //              const packingMaterial =
        //                packingComponent.PackingMaterial || "102";
        //              const packingQty =
        //                packingComponent.PackingInstructionItmTargetQty ||
        //                quantity;
        //              const unitOfMeasure =
        //                packingComponent.UnitOfMeasure || unit;
        //              const huType =
        //                packingComponent.to_PackingInstructionHeader
        //                  ?.HandlingUnitType || "";
        //
        //              // Restituisci oggetto pulito
        //              resolve({
        //                materials: payload.to_MaterialDocumentItem,
        //                packingMaterial: packingMaterial,
        //                packingQty: packingQty,
        //                material: material,
        //                quantity: quantity,
        //                unit: unitOfMeasure,
        //                batch: batch,
        //                huType: huType,
        //                csrfToken: csrfToken,
        //              });
        //            } else {
        //              reject(
        //                new Error(
        //                  `Nessuna istruzione di packaging trovata per il materiale ${material}`
        //                )
        //              );
        //            }
        //          } catch (err) {
        //            reject(
        //              new Error(
        //                "Errore nel parsing della risposta PackingInstruction: " +
        //                  err.message
        //              )
        //            );
        //          }
        //        } else {
        //          reject(
        //            new Error(
        //              `Errore nel recupero delle istruzioni di packaging (${
        //                xhr.status
        //              }): ${xhr.statusText || xhr.responseText}`
        //            )
        //          );
        //        }
        //      }
        //    };
        //
        //    xhr.open("GET", url);
        //    xhr.setRequestHeader("Accept", "application/json");
        //    xhr.setRequestHeader("DataServiceVersion", "2.0");
        //    xhr.setRequestHeader("x-csrf-token", "fetch");
        //
        //    xhr.send();
        //  });
        //}

        // ============ STEP 1.5: Get Extras Packing Instructions ============
        function _getExtra(docNumber101) {
          return new Promise((resolve, reject) => {
            const url = `/sap/opu/odata/sap/ZSB_PROD_RF_V2/getPICK?MaterialDocument='${docNumber101.docNumber}'&MaterialDocumentYear='${docNumber101.docNumberYear}'`;

            const xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("x-csrf-token", "fetch");

            xhr.onreadystatechange = function () {
              if (this.readyState === this.DONE) {
                if (this.status >= 200 && this.status < 300) {
                  const response = JSON.parse(this.responseText);

                  resolve({
                    MaterialDocument: response.d.getPICK.Materialdocument,
                    MaterialDocumentYear:
                      response.d.getPICK.Materialdocumentyear,
                    PackagingMaterial: response.d.getPICK.Packagingmaterial,
                    HandlingUnitQuantity: response.d.getPICK.Movementquantity,
                    HandlingUnitQuantityUnit:
                      response.d.getPICK.Baseunitofmeasure,
                    Plant: response.d.getPICK.Plant,
                    StorageLocation: response.d.getPICK.Storagelocation,

                    xCsrfToken: xhr.getResponseHeader("x-csrf-token"),
                  });
                } else {
                  const msg = JSON.parse(xhr.responseText);
                  reject(new Error(msg.error.message));
                }
              }
            };

            xhr.send();
          });
        }

        // ============ STEP 2: Create HU (XHR + CSRF token) ============
        function _createHU(packingData, originalPayload) {
          return new Promise((resolve, reject) => {
            // Payload per la creazione HU
            const huPayload = {
              HandlingUnitExternalID: "$1",
              Warehouse: "",
              PackagingMaterial: packingData.PackagingMaterial,
              _HandlingUnitItem: [
                {
                  HandlingUnitExternalID: "$1",
                  HandlingUnitTypeOfContent: "1",
                  Plant: packingData.Plant || "0100",
                  StorageLocation: packingData.StorageLocation || "ENTB",
                  Material: originalPayload.to_MaterialDocumentItem[0].Material,
                  HandlingUnitQuantity: Number(
                    packingData.HandlingUnitQuantity
                  ),
                  HandlingUnitQuantityUnit:
                    packingData.HandlingUnitQuantityUnit,
                  Batch: originalPayload.to_MaterialDocumentItem[0].Batch,
                },
              ],
            };

            const xhr = new XMLHttpRequest();

            // Endpoint API per la creazione HU
            const sUrl =
              "/sap/opu/odata4/sap/api_handlingunit/srvd_a2x/sap/handlingunit/0001/HandlingUnit";

            xhr.open("POST", sUrl);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("x-csrf-token", packingData.xCsrfToken);

            xhr.onreadystatechange = function () {
              if (this.readyState === this.DONE) {
                if (this.status >= 200 && this.status < 300) {
                  const response = JSON.parse(this.responseText);
                  const createdHUId =
                    response?.HandlingUnitExternalID || huExternalID;

                  resolve({
                    huID: createdHUId,
                    huData: response,
                    packingData: packingData,
                  });
                } else {
                  const msg = JSON.parse(xhr.responseText);
                  reject(new Error(msg.error.message));
                }
              }
            };

            xhr.send(JSON.stringify(huPayload));
          });
        }

        // ============ STEP 3: Move HU to eWM (XHR + CSRF token) ============
        function _moveHUtoEWM(packingData, huData) {
          return new Promise((resolve, reject) => {
            const { huID } = huData;

            // Payload secondo specifica API
            const payload = {
              HandlingUnitExternalID: huID,
              HandlingUnitGoodsMovementEvent: "0006",
              ReceivingPlant: "0100",
              ReceivingStorageLocation: "MWMB",
              ReceivingStorageBin: "GR-AREA",
            };

            let Warehouse = "";
            let url = `/sap/opu/odata4/sap/api_handlingunit/srvd_a2x/sap/handlingunit/0001/HandlingUnit(HandlingUnitExternalID='${huID}',Warehouse='${Warehouse}')/SAP__self.MoveHandlingUnits`;

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;

            xhr.onreadystatechange = function () {
              if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const response = xhr.responseText
                      ? JSON.parse(xhr.responseText)
                      : {};

                    resolve({
                      moveID: huID,
                      moveData: response,
                      huData: huData,
                    });
                  } catch (err) {
                    resolve({
                      moveID: huID,
                      moveData: {},
                      huData: huData,
                    });
                  }
                } else {
                  const msg = JSON.parse(xhr.responseText);
                  reject(new Error(msg.error.message));
                }
              }
            };

            xhr.open("POST", url);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("DataServiceVersion", "4.0");
            xhr.setRequestHeader("x-csrf-token", packingData.xCsrfToken);
            xhr.setRequestHeader("If-Match", "*");

            xhr.send(JSON.stringify(payload));
          });
        }

        // ============ STEP 4: Create eWM Task ============

        function _createEWMTask(huData) {
          return new Promise((resolve, reject) => {
            const { huID, packingData } = huData;

            // Body per la creazione del task
            const taskPayload = {
              EWMWarehouse: "WMB0",
              SourceHandlingUnit: huID,
              WarehouseProcessType: "S310",
              // DestinationStorageType e DestinationStorageBin opzionali
              // DestinationStorageType: "S970",
              // DestinationStorageBin: "CL-AREA"
            };

            // URL FM 4
            const url =
              "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask";

            const xhr = new XMLHttpRequest();
            xhr.withCredentials = true;

            xhr.onreadystatechange = function () {
              if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const response = xhr.responseText
                      ? JSON.parse(xhr.responseText)
                      : {};
                    const taskID =
                      response.WarehouseTask || response.id || "N/A";

                    resolve({ taskID, taskData: response, huData });
                  } catch (err) {
                    resolve({ taskID: "N/A", taskData: {}, huData });
                  }
                } else {
                  const msg = JSON.parse(xhr.responseText);
                  reject(new Error(msg.error.message));
                }
              }
            };

            xhr.open("POST", url);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("x-csrf-token", packingData.xCsrfToken);
            xhr.setRequestHeader("If-Match", "*");
            xhr.send(JSON.stringify(taskPayload));
          });
        }

        // ============ Success Handler ============
        function _onSaveSuccess(context, resultsSummary) {
          const i18n = context.getView().getModel("i18n").getResourceBundle();

          const summaryText = resultsSummary
            .map((r) => `• ${r.step}: ${r.id}`)
            .join("\n");

          const message =
            `${i18n.getText("success.flow.completed.text")}\n\n` +
            `${i18n.getText("success.flow.documents")}\n${summaryText}`;

          sap.m.MessageBox.success(message, {
            title: i18n.getText("success.flow.completed.title"),
            actions: [sap.m.MessageBox.Action.OK],
            onClose: function () {
              // Reset dei dati
              globalThis.readData = {};
              globalThis.finalPayload = {
                PostingDate: "",
                GoodsMovementCode: "",
                to_MaterialDocumentItem: [],
              };
              globalThis.finalPayloadList = [];
              sessionStorage.removeItem("finalPayload");
              sessionStorage.removeItem("finalPayloadList");

              const oEmptyModel = new sap.ui.model.json.JSONModel({
                items: [{ article: "", qty: "", unit: "", pal: "" }],
              });
              context.getView().setModel(oEmptyModel, "model");

              const oRouter = sap.ui.core.UIComponent.getRouterFor(context);
              oRouter.navTo("RouteFirstView");
            },
          });
        }

        // ============ Error Handler ============
        function _onSaveError(error, context) {
          sap.m.MessageBox.error(error.message, {
            title: "Error",
          });
        }
      },

      onNavBack: function () {
        var sOrigin = window.location.origin;
        var sUrl = sOrigin + "/ui?sap-ushell-config=headerless#RFMenu-display";
        window.location.href = sUrl;
      },
    });
  }
);
